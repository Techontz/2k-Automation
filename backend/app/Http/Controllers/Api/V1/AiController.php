<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AiSetting;
use App\Models\KnowledgeItem;
use App\Services\Ai\AiResponder;
use App\Services\AuditLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $workspace = $this->workspace($request);
        $settings = AiSetting::forWorkspaceOrDefault($workspace);

        return response()->json([
            'settings' => $settings,
            'has_workspace_key' => filled($settings->getRawOriginal('api_key')),
            'platform_keys' => ['anthropic' => filled(config('services.anthropic.key')), 'openai' => filled(config('services.openai.key'))],
            'default_models' => ['anthropic' => config('services.anthropic.model'), 'openai' => config('services.openai.model')],
            'knowledge' => KnowledgeItem::forWorkspace($workspace)->latest()->get(),
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'ai.manage');
        $data = $request->validate([
            'enabled' => ['sometimes', 'boolean'],
            'provider' => ['sometimes', 'in:anthropic,openai'],
            'model' => ['sometimes', 'nullable', 'string', 'max:80'],
            'api_key' => ['sometimes', 'nullable', 'string', 'max:300'],
            'assistant_name' => ['sometimes', 'string', 'max:60'],
            'brand_voice' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'languages' => ['sometimes', 'array', 'min:1'],
            'languages.*' => ['in:en,sw'],
            'confidence_threshold' => ['sometimes', 'numeric', 'between:0,1'],
            'handover_keywords' => ['sometimes', 'array'],
            'handover_keywords.*' => ['string', 'max:40'],
            'extra_instructions' => ['sometimes', 'nullable', 'string', 'max:4000'],
            'auto_reply_dms' => ['sometimes', 'boolean'],
        ]);

        $settings = AiSetting::forWorkspaceOrDefault($this->workspace($request));

        if (array_key_exists('api_key', $data) && $data['api_key'] === '') {
            $data['api_key'] = null;
        } elseif (array_key_exists('api_key', $data) && $data['api_key'] === null) {
            unset($data['api_key']);
        }

        $settings->update($data);
        AuditLogger::log('ai.settings_updated', $settings, array_keys($data));

        return response()->json(['settings' => $settings, 'has_workspace_key' => filled($settings->getRawOriginal('api_key'))]);
    }

    public function test(Request $request, AiResponder $ai): JsonResponse
    {
        $data = $request->validate(['message' => ['required', 'string', 'max:1000']]);
        $reply = $ai->respond($this->workspace($request), null, $data['message']);

        return response()->json([
            'reply' => $reply->text,
            'confidence' => $reply->confidence,
            'language' => $reply->language,
            'handover' => $reply->shouldHandover,
            'reason' => $reply->handoverReason,
            'provider' => $reply->provider,
        ]);
    }

    public function storeKnowledge(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'ai.manage');
        $data = $request->validate(['title' => ['required', 'string', 'max:160'], 'content' => ['required', 'string', 'max:10000'], 'enabled' => ['sometimes', 'boolean']]);

        return response()->json(KnowledgeItem::create(['workspace_id' => $this->workspace($request)->id, ...$data]), 201);
    }

    public function updateKnowledge(Request $request, int $item): JsonResponse
    {
        $this->authorizeAbility($request, 'ai.manage');
        $model = KnowledgeItem::forWorkspace($this->workspace($request))->findOrFail($item);
        $model->update($request->validate(['title' => ['sometimes', 'string', 'max:160'], 'content' => ['sometimes', 'string', 'max:10000'], 'enabled' => ['sometimes', 'boolean']]));

        return response()->json($model);
    }

    public function destroyKnowledge(Request $request, int $item): JsonResponse
    {
        $this->authorizeAbility($request, 'ai.manage');
        KnowledgeItem::forWorkspace($this->workspace($request))->findOrFail($item)->delete();

        return response()->json(['ok' => true]);
    }
}
