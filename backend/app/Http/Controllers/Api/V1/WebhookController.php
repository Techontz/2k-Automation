<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\Webhooks\MetaPayloadNormalizer;
use App\Services\Webhooks\SignatureVerifier;
use App\Services\Webhooks\TikTokPayloadNormalizer;
use App\Services\Webhooks\WebhookRecorder;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * Public webhook endpoints. Responds fast (platforms retry slow responses);
 * all real work happens in queued jobs.
 */
class WebhookController extends Controller
{
    public function __construct(
        private readonly SignatureVerifier $verifier,
        private readonly WebhookRecorder $recorder,
    ) {}

    public function verifyMeta(Request $request): Response
    {
        $token = (string) config('services.meta.webhook_verify_token');

        if ($token !== '' && $request->query('hub_mode') === 'subscribe' && hash_equals($token, (string) $request->query('hub_verify_token'))) {
            return response((string) $request->query('hub_challenge'), 200)->header('Content-Type', 'text/plain');
        }

        return response('Verification failed', 403);
    }

    public function receiveMeta(Request $request, MetaPayloadNormalizer $normalizer): Response
    {
        if (! $this->verifier->verifyMeta($request->getContent(), $request->header('X-Hub-Signature-256'))) {
            Log::warning('Rejected Meta webhook with invalid signature', ['ip' => $request->ip()]);

            return response('Invalid signature', 401);
        }

        $this->recorder->record($normalizer->normalize($request->json()->all()));

        return response('EVENT_RECEIVED', 200);
    }

    public function receiveTikTok(Request $request, TikTokPayloadNormalizer $normalizer): Response
    {
        if (! $this->verifier->verifyTikTok($request->getContent(), $request->header('TikTok-Signature'))) {
            return response('Invalid signature', 401);
        }

        $this->recorder->record($normalizer->normalize($request->json()->all()));

        return response('OK', 200);
    }
}
