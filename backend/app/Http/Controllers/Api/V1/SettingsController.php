<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Channel;
use App\Models\WebhookEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    /**
     * Webhook health and integration configuration status (no secrets returned).
     */
    public function integrations(Request $request): JsonResponse
    {
        $channelIds = Channel::forWorkspace($this->workspace($request))->pluck('id');
        $events = WebhookEvent::whereIn('channel_id', $channelIds)->where('created_at', '>=', now()->subDay());

        return response()->json([
            'webhook_urls' => [
                'meta' => route('v1.webhooks.meta'),
                'tiktok' => route('v1.webhooks.tiktok'),
                'oauth_instagram' => route('v1.oauth.callback', 'instagram'),
                'oauth_facebook' => route('v1.oauth.callback', 'facebook'),
                'oauth_tiktok' => route('v1.oauth.callback', 'tiktok'),
            ],
            'configured' => [
                'meta_app' => filled(config('services.meta.app_id')) && filled(config('services.meta.app_secret')),
                'meta_verify_token' => filled(config('services.meta.webhook_verify_token')),
                'instagram_app' => filled(config('services.instagram.app_id')) && filled(config('services.instagram.app_secret')),
                'whatsapp_embedded_signup' => filled(config('services.whatsapp.embedded_signup_config_id')),
                'tiktok_app' => filled(config('services.tiktok.app_id')) && filled(config('services.tiktok.app_secret')),
                'anthropic' => filled(config('services.anthropic.key')),
                'openai' => filled(config('services.openai.key')),
                'queue_driver' => config('queue.default'),
                'graph_version' => config('services.meta.graph_version'),
            ],
            'webhook_health' => [
                'last_24h' => (clone $events)->count(),
                'failed_24h' => (clone $events)->where('status', 'failed')->count(),
                'by_status' => (clone $events)->selectRaw('status, count(*) as total')->groupBy('status')->pluck('total', 'status'),
                'recent' => WebhookEvent::whereIn('channel_id', $channelIds)->latest('id')->limit(25)->get(['id', 'platform', 'event_type', 'status', 'outcome', 'error', 'is_simulated', 'attempts', 'created_at']),
            ],
        ]);
    }

    public function auditLogs(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'settings.manage');

        return response()->json(
            AuditLog::where('workspace_id', $this->workspace($request)->id)->with('user:id,name,email')->latest('id')->paginate(50)
        );
    }
}
