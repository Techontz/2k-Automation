<?php

namespace App\Services\Platforms;

use App\Models\Channel;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;

/**
 * TikTok API for Business (Accounts API): list videos and reply to comments on
 * the connected business account's own videos. Direct messages are not
 * generally available to third-party apps, so DM sends are refused.
 */
class TikTokClient implements PlatformClient
{
    public function replyToComment(Channel $channel, string $commentId, string $text): SendResult
    {
        $response = $this->post($channel, 'business/comment/reply/create/', [
            'business_id' => $channel->external_id,
            'video_id' => $channel->metaValue('pending_video_id'),
            'comment_id' => $commentId,
            'text' => mb_substr($text, 0, 150),
        ]);

        return new SendResult($response['data']['comment_id'] ?? null, $response);
    }

    public function sendPrivateReply(Channel $channel, string $commentId, OutboundMessage $message): SendResult
    {
        throw PlatformException::unsupported('TikTok does not offer private replies to comments for third-party apps.');
    }

    public function sendMessage(Channel $channel, string $recipientId, OutboundMessage $message, ?string $tag = null): SendResult
    {
        throw PlatformException::unsupported('TikTok direct messaging is not available through the public API for this account.');
    }

    public function sendTemplate(Channel $channel, string $recipientId, string $template, string $language, array $parameters = []): SendResult
    {
        throw PlatformException::unsupported('TikTok has no message templates.');
    }

    public function fetchPosts(Channel $channel, int $limit = 20): array
    {
        $response = $this->get($channel, 'business/video/list/', [
            'business_id' => $channel->external_id,
            'fields' => json_encode(['item_id', 'caption', 'thumbnail_url', 'share_url', 'create_time']),
            'max_count' => min($limit, 20),
        ]);

        return array_map(fn (array $video): array => [
            'external_id' => (string) $video['item_id'],
            'media_type' => 'video',
            'caption' => $video['caption'] ?? null,
            'permalink' => $video['share_url'] ?? null,
            'thumbnail_url' => $video['thumbnail_url'] ?? null,
            'published_at' => isset($video['create_time']) ? date(DATE_ATOM, (int) $video['create_time']) : null,
        ], $response['data']['videos'] ?? []);
    }

    public function subscribeWebhooks(Channel $channel): void
    {
        // TikTok webhook subscriptions are configured at the app level in the developer portal.
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    private function get(Channel $channel, string $path, array $query): array
    {
        return $this->request('get', $channel, $path, $query);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    private function post(Channel $channel, string $path, array $body): array
    {
        return $this->request('post', $channel, $path, $body);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function request(string $method, Channel $channel, string $path, array $data): array
    {
        try {
            $response = Http::withHeaders(['Access-Token' => $channel->access_token])
                ->acceptJson()
                ->timeout(15)
                ->{$method}(rtrim(config('services.tiktok.api_base'), '/').'/'.$path, $data);
        } catch (ConnectionException $exception) {
            throw new PlatformException('Could not reach TikTok: '.$exception->getMessage(), PlatformException::Transient);
        }

        $code = (int) $response->json('code', $response->successful() ? 0 : -1);

        if ($response->successful() && $code === 0) {
            return $response->json() ?? [];
        }

        $category = match (true) {
            $response->status() === 429, $code === 40100 => PlatformException::RateLimited,
            in_array($code, [40104, 40105, 40001], true), $response->status() === 401 => PlatformException::Auth,
            $response->serverError() => PlatformException::Transient,
            default => PlatformException::Invalid,
        };

        throw new PlatformException($response->json('message', 'TikTok API error'), $category, (string) $code);
    }
}
