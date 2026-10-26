<?php

use App\Http\Controllers\Api\V1;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->name('v1.')->group(function (): void {
    /*
    | Public endpoints
    */
    Route::middleware('throttle:auth')->group(function (): void {
        Route::post('auth/register', [V1\AuthController::class, 'register'])->name('auth.register');
        Route::post('auth/login', [V1\AuthController::class, 'login'])->name('auth.login');
    });

    Route::middleware('throttle:webhooks')->group(function (): void {
        Route::get('webhooks/meta', [V1\WebhookController::class, 'verifyMeta']);
        Route::post('webhooks/meta', [V1\WebhookController::class, 'receiveMeta'])->name('webhooks.meta');
        Route::post('webhooks/tiktok', [V1\WebhookController::class, 'receiveTikTok'])->name('webhooks.tiktok');
    });

    Route::get('oauth/{platform}/callback', [V1\ChannelController::class, 'callback'])->name('oauth.callback')->whereIn('platform', ['instagram', 'facebook', 'tiktok']);
    Route::get('email/unsubscribe/{contact}', [V1\EmailController::class, 'unsubscribe'])->name('email.unsubscribe');

    /*
    | Authenticated, not workspace-scoped
    */
    Route::middleware(['auth:sanctum', 'throttle:api'])->group(function (): void {
        Route::post('auth/logout', [V1\AuthController::class, 'logout']);
        Route::get('auth/me', [V1\AuthController::class, 'me']);
        Route::patch('auth/me', [V1\AuthController::class, 'updateProfile']);
        Route::get('workspaces', [V1\WorkspaceController::class, 'index']);
        Route::post('workspaces', [V1\WorkspaceController::class, 'store']);
        Route::post('workspaces/{workspace}/switch', [V1\WorkspaceController::class, 'switch']);

        /*
        | Workspace-scoped (X-Workspace-Id header or current workspace)
        */
        Route::middleware('workspace')->group(function (): void {
            Route::get('workspace', [V1\WorkspaceController::class, 'current']);
            Route::patch('workspace', [V1\WorkspaceController::class, 'update']);

            Route::get('team', [V1\TeamController::class, 'index']);
            Route::get('team/roles', [V1\TeamController::class, 'roles']);
            Route::post('team/invitations', [V1\TeamController::class, 'invite']);
            Route::delete('team/invitations/{invitation}', [V1\TeamController::class, 'revokeInvitation']);
            Route::patch('team/members/{user}', [V1\TeamController::class, 'updateRole']);
            Route::delete('team/members/{user}', [V1\TeamController::class, 'remove']);

            Route::get('channels', [V1\ChannelController::class, 'index']);
            Route::post('channels/connect/{platform}', [V1\ChannelController::class, 'connect']);
            Route::post('channels/whatsapp', [V1\ChannelController::class, 'connectWhatsApp']);
            Route::get('channels/{channel}/posts', [V1\ChannelController::class, 'posts']);
            Route::post('channels/{channel}/posts/sync', [V1\ChannelController::class, 'syncPosts']);
            Route::delete('channels/{channel}', [V1\ChannelController::class, 'destroy']);

            Route::get('automations/templates', [V1\AutomationController::class, 'templates']);
            Route::get('automations', [V1\AutomationController::class, 'index'])->name('automations.index');
            Route::post('automations', [V1\AutomationController::class, 'store'])->name('automations.store');
            Route::get('automations/{automation}', [V1\AutomationController::class, 'show'])->name('automations.show');
            Route::patch('automations/{automation}', [V1\AutomationController::class, 'update'])->name('automations.update');
            Route::delete('automations/{automation}', [V1\AutomationController::class, 'destroy']);
            Route::post('automations/{automation}/activate', [V1\AutomationController::class, 'activate']);
            Route::post('automations/{automation}/pause', [V1\AutomationController::class, 'pause']);
            Route::post('automations/{automation}/duplicate', [V1\AutomationController::class, 'duplicate'])->name('automations.duplicate');
            Route::get('automations/{automation}/validate', [V1\AutomationController::class, 'validateFlow']);
            Route::get('automations/{automation}/runs', [V1\AutomationController::class, 'runs']);

            Route::get('runs', [V1\RunController::class, 'index']);
            Route::get('runs/{run}', [V1\RunController::class, 'show']);
            Route::post('runs/{run}/cancel', [V1\RunController::class, 'cancel']);

            Route::get('comments', [V1\CommentController::class, 'index']);
            Route::post('comments/{comment}/reply', [V1\CommentController::class, 'reply']);

            Route::get('conversations', [V1\ConversationController::class, 'index']);
            Route::get('conversations/{conversation}', [V1\ConversationController::class, 'show']);
            Route::patch('conversations/{conversation}', [V1\ConversationController::class, 'update']);
            Route::post('conversations/{conversation}/messages', [V1\ConversationController::class, 'reply']);
            Route::post('conversations/{conversation}/suggest', [V1\ConversationController::class, 'suggest'])->middleware('throttle:ai');

            Route::get('contacts', [V1\ContactController::class, 'index']);
            Route::get('contacts/export', [V1\ContactController::class, 'export']);
            Route::get('contacts/{contact}', [V1\ContactController::class, 'show']);
            Route::patch('contacts/{contact}', [V1\ContactController::class, 'update']);
            Route::delete('contacts/{contact}', [V1\ContactController::class, 'destroy']);
            Route::put('contacts/{contact}/tags', [V1\ContactController::class, 'syncTags']);
            Route::post('contacts/{contact}/consents', [V1\ContactController::class, 'recordConsent']);

            Route::get('tags', [V1\TagController::class, 'index']);
            Route::post('tags', [V1\TagController::class, 'store']);
            Route::delete('tags/{tag}', [V1\TagController::class, 'destroy']);

            Route::get('email', [V1\EmailController::class, 'overview']);
            Route::post('email/providers', [V1\EmailController::class, 'storeProvider']);
            Route::patch('email/providers/{provider}', [V1\EmailController::class, 'updateProvider']);
            Route::delete('email/providers/{provider}', [V1\EmailController::class, 'destroyProvider']);
            Route::get('email/templates/{template}', [V1\EmailController::class, 'showTemplate']);
            Route::post('email/templates', [V1\EmailController::class, 'storeTemplate']);
            Route::patch('email/templates/{template}', [V1\EmailController::class, 'updateTemplate']);
            Route::delete('email/templates/{template}', [V1\EmailController::class, 'destroyTemplate']);
            Route::post('email/campaigns', [V1\EmailController::class, 'storeCampaign']);
            Route::delete('email/campaigns/{campaign}', [V1\EmailController::class, 'destroyCampaign']);
            Route::get('email/campaigns/{campaign}/audience', [V1\EmailController::class, 'previewAudience']);
            Route::post('email/campaigns/{campaign}/send', [V1\EmailController::class, 'sendCampaign']);
            Route::get('email/sends', [V1\EmailController::class, 'sends']);

            Route::get('ai', [V1\AiController::class, 'show']);
            Route::patch('ai', [V1\AiController::class, 'update']);
            Route::post('ai/test', [V1\AiController::class, 'test'])->middleware('throttle:ai');
            Route::post('ai/knowledge', [V1\AiController::class, 'storeKnowledge']);
            Route::patch('ai/knowledge/{item}', [V1\AiController::class, 'updateKnowledge']);
            Route::delete('ai/knowledge/{item}', [V1\AiController::class, 'destroyKnowledge']);

            Route::get('analytics/overview', [V1\AnalyticsController::class, 'overview']);
            Route::get('analytics/timeseries', [V1\AnalyticsController::class, 'timeseries']);
            Route::get('analytics/automations', [V1\AnalyticsController::class, 'automations']);

            Route::get('simulator', [V1\SimulatorController::class, 'state']);
            Route::post('simulator/comment', [V1\SimulatorController::class, 'comment']);
            Route::post('simulator/message', [V1\SimulatorController::class, 'message']);
            Route::get('simulator/conversation', [V1\SimulatorController::class, 'conversation']);
            Route::post('simulator/runs/{run}/fast-forward', [V1\SimulatorController::class, 'fastForward']);
            Route::post('simulator/reset', [V1\SimulatorController::class, 'reset']);

            Route::get('settings/integrations', [V1\SettingsController::class, 'integrations']);
            Route::get('settings/audit-logs', [V1\SettingsController::class, 'auditLogs']);
        });
    });
});
