<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ChannelResource;
use App\Models\Channel;
use App\Models\Post;
use App\Services\AuditLogger;
use App\Services\OAuth\ChannelConnector;
use App\Services\OAuth\OAuthStateStore;
use App\Services\Platforms\PlatformClientFactory;
use App\Services\Platforms\PlatformException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Throwable;

class ChannelController extends Controller
{
    public function __construct(
        private readonly ChannelConnector $connector,
        private readonly OAuthStateStore $states,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return ChannelResource::collection(
            Channel::forWorkspace($this->workspace($request))->withCount('posts')->orderBy('is_simulated')->orderBy('platform')->get()
        );
    }

    /**
     * Start an OAuth connection: returns the platform authorization URL.
     */
    public function connect(Request $request, string $platform): JsonResponse
    {
        $this->authorizeAbility($request, 'channels.manage');
        abort_unless(in_array($platform, ['instagram', 'facebook', 'tiktok'], true), 404);

        if ($missing = $this->connector->missingConfig($platform)) {
            return response()->json([
                'message' => 'This integration is not configured yet. Set '.implode(', ', $missing).' in backend/.env (see docs/SETUP_INTEGRATIONS.md).',
                'code' => 'integration_not_configured',
                'missing' => $missing,
                'redirect_uri' => $this->connector->redirectUri($platform),
            ], 422);
        }

        $state = $this->states->issue($platform, $this->workspace($request)->id, $request->user()->id);

        return response()->json(['url' => $this->connector->authorizationUrl($platform, $state)]);
    }

    /**
     * OAuth redirect target (public). Exchanges the code and returns to the dashboard.
     */
    public function callback(Request $request, string $platform): RedirectResponse
    {
        $frontend = rtrim(config('automation.frontend_url'), '/').'/channels';
        $state = $this->states->consume($platform, $request->query('state'));

        if (! $state) {
            return redirect()->away($frontend.'?error='.urlencode('The connection link expired. Please try again.'));
        }

        if ($request->query('error') || ! $request->query('code')) {
            return redirect()->away($frontend.'?error='.urlencode((string) ($request->query('error_description') ?? 'Authorization was cancelled.')));
        }

        try {
            $channels = $this->connector->complete($platform, (string) $request->query('code'), $state['workspaceId']);
        } catch (Throwable $exception) {
            report($exception);

            return redirect()->away($frontend.'?error='.urlencode('Connection failed: '.mb_strimwidth($exception->getMessage(), 0, 200, '…')));
        }

        return redirect()->away($frontend.'?connected='.$platform.'&count='.count($channels));
    }

    public function connectWhatsApp(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'channels.manage');

        if ($missing = $this->connector->missingConfig('whatsapp')) {
            return response()->json(['message' => 'Set '.implode(', ', $missing).' in backend/.env first.', 'code' => 'integration_not_configured', 'missing' => $missing], 422);
        }

        $data = $request->validate([
            'phone_number_id' => ['required', 'string', 'max:40'],
            'waba_id' => ['required', 'string', 'max:40'],
            'code' => ['nullable', 'string'],
            'access_token' => ['nullable', 'string'],
        ]);

        try {
            $channel = $this->connector->connectWhatsApp($this->workspace($request)->id, $data['phone_number_id'], $data['waba_id'], $data['code'] ?? null, $data['access_token'] ?? null);
        } catch (Throwable $exception) {
            return response()->json(['message' => 'Could not connect WhatsApp: '.$exception->getMessage()], 422);
        }

        return (new ChannelResource($channel))->response()->setStatusCode(201);
    }

    public function posts(Request $request, int $channel): JsonResponse
    {
        $model = Channel::forWorkspace($this->workspace($request))->findOrFail($channel);

        return response()->json(['data' => $model->posts()->orderByDesc('published_at')->orderByDesc('id')->limit(100)->get()]);
    }

    public function syncPosts(Request $request, int $channel, PlatformClientFactory $clients): JsonResponse
    {
        $model = Channel::forWorkspace($this->workspace($request))->findOrFail($channel);

        try {
            $posts = $clients->for($model)->fetchPosts($model);
        } catch (PlatformException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        foreach ($posts as $post) {
            Post::updateOrCreate(
                ['channel_id' => $model->id, 'external_id' => $post['external_id']],
                ['workspace_id' => $model->workspace_id, ...collect($post)->except('external_id')->all()],
            );
        }

        return response()->json(['synced' => count($posts)]);
    }

    public function destroy(Request $request, int $channel): JsonResponse
    {
        $this->authorizeAbility($request, 'channels.manage');
        $model = Channel::forWorkspace($this->workspace($request))->findOrFail($channel);
        $model->forceFill(['status' => 'disconnected', 'access_token' => null, 'status_reason' => 'Disconnected by '.$request->user()->name])->save();
        AuditLogger::log('channel.disconnected', $model);

        return response()->json(['ok' => true]);
    }
}
