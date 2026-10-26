<?php

namespace App\Services\OAuth;

use App\Enums\Platform;
use App\Models\Channel;
use App\Services\AuditLogger;
use App\Services\Platforms\MetaGraphApi;
use App\Services\Platforms\PlatformClientFactory;
use App\Services\Platforms\PlatformException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Builds authorization URLs and exchanges OAuth codes for long-lived tokens,
 * creating (or refreshing) Channel records and subscribing them to webhooks.
 */
class ChannelConnector
{
    public function __construct(private readonly PlatformClientFactory $clients) {}

    /**
     * Env vars that must be set before a platform can be connected.
     *
     * @return list<string>
     */
    public function missingConfig(string $platform): array
    {
        $required = match ($platform) {
            'instagram' => ['services.instagram.app_id' => 'INSTAGRAM_APP_ID', 'services.instagram.app_secret' => 'INSTAGRAM_APP_SECRET'],
            'facebook', 'whatsapp' => ['services.meta.app_id' => 'META_APP_ID', 'services.meta.app_secret' => 'META_APP_SECRET'],
            'tiktok' => ['services.tiktok.app_id' => 'TIKTOK_APP_ID', 'services.tiktok.app_secret' => 'TIKTOK_APP_SECRET'],
            default => [],
        };

        return array_values(array_filter($required, fn (string $env, string $key): bool => blank(config($key)), ARRAY_FILTER_USE_BOTH));
    }

    public function authorizationUrl(string $platform, string $state): string
    {
        $redirect = $this->redirectUri($platform);

        return match ($platform) {
            'instagram' => 'https://www.instagram.com/oauth/authorize?'.http_build_query([
                'client_id' => config('services.instagram.app_id'),
                'redirect_uri' => $redirect,
                'response_type' => 'code',
                'scope' => implode(',', config('services.instagram.scopes')),
                'state' => $state,
            ]),
            'facebook' => 'https://www.facebook.com/'.config('services.meta.graph_version').'/dialog/oauth?'.http_build_query([
                'client_id' => config('services.meta.app_id'),
                'redirect_uri' => $redirect,
                'scope' => implode(',', config('services.meta.messenger_scopes')),
                'state' => $state,
            ]),
            // UNVERIFIED: confirm against the TikTok API for Business portal when the app is approved.
            'tiktok' => 'https://business-api.tiktok.com/portal/auth?'.http_build_query([
                'app_id' => config('services.tiktok.app_id'),
                'redirect_uri' => $redirect,
                'state' => $state,
            ]),
            default => throw new RuntimeException("{$platform} does not use a redirect OAuth flow."),
        };
    }

    public function redirectUri(string $platform): string
    {
        return route('v1.oauth.callback', ['platform' => $platform]);
    }

    /**
     * @return list<Channel>
     */
    public function complete(string $platform, string $code, int $workspaceId): array
    {
        return match ($platform) {
            'instagram' => [$this->completeInstagram($code, $workspaceId)],
            'facebook' => $this->completeFacebook($code, $workspaceId),
            'tiktok' => [$this->completeTikTok($code, $workspaceId)],
            default => throw new RuntimeException('Unsupported platform.'),
        };
    }

    public function connectWhatsApp(int $workspaceId, string $phoneNumberId, string $wabaId, ?string $code, ?string $accessToken): Channel
    {
        if ($code) {
            $accessToken = $this->graphTokenExchange(['code' => $code])['access_token'];
        }

        if (! $accessToken) {
            throw new RuntimeException('Provide an Embedded Signup code or a system user access token.');
        }

        $number = MetaGraphApi::facebook()->get($phoneNumberId, $accessToken, ['fields' => 'display_phone_number,verified_name,quality_rating']);

        return $this->store($workspaceId, Platform::WhatsApp, $phoneNumberId, [
            'name' => $number['verified_name'] ?? 'WhatsApp Business',
            'username' => $number['display_phone_number'] ?? null,
            'access_token' => $accessToken,
            'token_expires_at' => null,
            'scopes' => config('services.whatsapp.scopes'),
            'meta' => ['waba_id' => $wabaId, 'quality_rating' => $number['quality_rating'] ?? null],
        ]);
    }

    private function completeInstagram(string $code, int $workspaceId): Channel
    {
        $short = Http::asForm()->timeout(15)->post('https://api.instagram.com/oauth/access_token', [
            'client_id' => config('services.instagram.app_id'),
            'client_secret' => config('services.instagram.app_secret'),
            'grant_type' => 'authorization_code',
            'redirect_uri' => $this->redirectUri('instagram'),
            'code' => $code,
        ]);

        if ($short->failed()) {
            throw new RuntimeException('Instagram rejected the authorization code: '.$short->json('error_message', $short->body()));
        }

        $long = Http::timeout(15)->get('https://graph.instagram.com/access_token', [
            'grant_type' => 'ig_exchange_token',
            'client_secret' => config('services.instagram.app_secret'),
            'access_token' => $short->json('access_token'),
        ])->throw()->json();

        $profile = MetaGraphApi::instagram()->get('me', $long['access_token'], ['fields' => 'user_id,username,name,profile_picture_url']);

        return $this->store($workspaceId, Platform::Instagram, (string) ($profile['user_id'] ?? $profile['id']), [
            'name' => $profile['name'] ?? $profile['username'],
            'username' => $profile['username'] ?? null,
            'avatar_url' => $profile['profile_picture_url'] ?? null,
            'access_token' => $long['access_token'],
            'token_expires_at' => now()->addSeconds((int) ($long['expires_in'] ?? 5184000)),
            'scopes' => $short->json('permissions') ? explode(',', (string) $short->json('permissions')) : config('services.instagram.scopes'),
        ]);
    }

    /**
     * @return list<Channel>
     */
    private function completeFacebook(string $code, int $workspaceId): array
    {
        $userToken = $this->graphTokenExchange(['code' => $code, 'redirect_uri' => $this->redirectUri('facebook')])['access_token'];
        $longUserToken = $this->graphTokenExchange(['grant_type' => 'fb_exchange_token', 'fb_exchange_token' => $userToken])['access_token'];
        $pages = MetaGraphApi::facebook()->get('me/accounts', $longUserToken, ['fields' => 'id,name,access_token,picture{url}', 'limit' => 100]);

        $channels = [];

        foreach ($pages['data'] ?? [] as $page) {
            $channels[] = $this->store($workspaceId, Platform::Facebook, (string) $page['id'], [
                'name' => $page['name'],
                'avatar_url' => $page['picture']['data']['url'] ?? null,
                'access_token' => $page['access_token'],
                'token_expires_at' => null,
                'scopes' => config('services.meta.messenger_scopes'),
            ]);
        }

        if ($channels === []) {
            throw new RuntimeException('No Facebook Pages were shared with 2K Automation. Reconnect and select at least one Page.');
        }

        return $channels;
    }

    private function completeTikTok(string $code, int $workspaceId): Channel
    {
        // UNVERIFIED endpoint/shape: confirm in the TikTok API for Business docs once approved.
        $response = Http::timeout(15)->post(rtrim(config('services.tiktok.api_base'), '/').'/tt_user/oauth2/token/', [
            'client_id' => config('services.tiktok.app_id'),
            'client_secret' => config('services.tiktok.app_secret'),
            'grant_type' => 'authorization_code',
            'auth_code' => $code,
            'redirect_uri' => $this->redirectUri('tiktok'),
        ])->throw()->json('data');

        return $this->store($workspaceId, Platform::TikTok, (string) $response['open_id'], [
            'name' => 'TikTok Business',
            'access_token' => $response['access_token'],
            'token_expires_at' => now()->addSeconds((int) ($response['expires_in'] ?? 86400)),
            'scopes' => explode(',', (string) ($response['scope'] ?? '')),
            'meta' => ['refresh_token_set' => isset($response['refresh_token'])],
        ]);
    }

    /**
     * @param  array<string, string>  $params
     * @return array<string, mixed>
     */
    private function graphTokenExchange(array $params): array
    {
        return Http::timeout(15)->get('https://graph.facebook.com/'.config('services.meta.graph_version').'/oauth/access_token', [
            'client_id' => config('services.meta.app_id'),
            'client_secret' => config('services.meta.app_secret'),
            ...$params,
        ])->throw()->json();
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function store(int $workspaceId, Platform $platform, string $externalId, array $attributes): Channel
    {
        $channel = Channel::updateOrCreate(
            ['workspace_id' => $workspaceId, 'platform' => $platform->value, 'external_id' => $externalId],
            [...$attributes, 'is_simulated' => false, 'status' => 'connected', 'status_reason' => null],
        );

        try {
            $this->clients->for($channel)->subscribeWebhooks($channel);
        } catch (PlatformException $exception) {
            $channel->forceFill(['status_reason' => 'Webhook subscription failed: '.$exception->getMessage()])->save();
        }

        AuditLogger::log('channel.connected', $channel, ['platform' => $platform->value], $workspaceId);

        return $channel;
    }
}
