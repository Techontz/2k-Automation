<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ConsentType;
use App\Http\Controllers\Controller;
use App\Jobs\SendEmailCampaign;
use App\Models\Contact;
use App\Models\EmailCampaign;
use App\Models\EmailProvider;
use App\Models\EmailSend;
use App\Models\EmailTemplate;
use App\Services\AuditLogger;
use App\Services\Contacts\ConsentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class EmailController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $workspace = $this->workspace($request);

        return response()->json([
            'providers' => EmailProvider::forWorkspace($workspace)->get(),
            'templates' => EmailTemplate::forWorkspace($workspace)->latest()->get(['id', 'name', 'subject', 'category', 'updated_at']),
            'campaigns' => EmailCampaign::forWorkspace($workspace)->with('template:id,name')->latest()->get(),
            'stats' => [
                'sent_30d' => EmailSend::forWorkspace($workspace)->where('status', 'sent')->where('created_at', '>=', now()->subDays(30))->count(),
                'failed_30d' => EmailSend::forWorkspace($workspace)->where('status', 'failed')->where('created_at', '>=', now()->subDays(30))->count(),
                'subscribers' => SendEmailCampaign::audienceQuery(new EmailCampaign(['workspace_id' => $workspace->id, 'audience' => []]))->count(),
            ],
        ]);
    }

    public function storeProvider(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'email.manage');
        $data = $this->validateProvider($request);
        $workspace = $this->workspace($request);

        if ($data['is_default'] ?? true) {
            EmailProvider::forWorkspace($workspace)->update(['is_default' => false]);
        }

        $provider = EmailProvider::create(['workspace_id' => $workspace->id, 'is_default' => true, ...$data]);
        AuditLogger::log('email.provider_created', $provider, ['driver' => $provider->driver]);

        return response()->json($provider, 201);
    }

    public function updateProvider(Request $request, int $provider): JsonResponse
    {
        $this->authorizeAbility($request, 'email.manage');
        $model = EmailProvider::forWorkspace($this->workspace($request))->findOrFail($provider);
        $data = $this->validateProvider($request, partial: true);

        if (isset($data['credentials'])) {
            $data['credentials'] = [...($model->credentials ?? []), ...array_filter($data['credentials'], fn ($value): bool => $value !== null && $value !== '')];
        }

        if ($data['is_default'] ?? false) {
            EmailProvider::forWorkspace($this->workspace($request))->whereKeyNot($model->id)->update(['is_default' => false]);
        }

        $model->update($data);

        return response()->json($model);
    }

    public function destroyProvider(Request $request, int $provider): JsonResponse
    {
        $this->authorizeAbility($request, 'email.manage');
        EmailProvider::forWorkspace($this->workspace($request))->findOrFail($provider)->delete();

        return response()->json(['ok' => true]);
    }

    public function showTemplate(Request $request, int $template): JsonResponse
    {
        return response()->json(EmailTemplate::forWorkspace($this->workspace($request))->findOrFail($template));
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'email.manage');

        return response()->json(EmailTemplate::create(['workspace_id' => $this->workspace($request)->id, ...$this->validateTemplate($request)]), 201);
    }

    public function updateTemplate(Request $request, int $template): JsonResponse
    {
        $this->authorizeAbility($request, 'email.manage');
        $model = EmailTemplate::forWorkspace($this->workspace($request))->findOrFail($template);
        $model->update($this->validateTemplate($request, partial: true));

        return response()->json($model);
    }

    public function destroyTemplate(Request $request, int $template): JsonResponse
    {
        $this->authorizeAbility($request, 'email.manage');
        EmailTemplate::forWorkspace($this->workspace($request))->findOrFail($template)->delete();

        return response()->json(['ok' => true]);
    }

    public function storeCampaign(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'email.manage');
        $workspace = $this->workspace($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email_template_id' => ['required', 'integer'],
            'email_provider_id' => ['nullable', 'integer'],
            'audience' => ['nullable', 'array'],
            'audience.tag_ids' => ['sometimes', 'array'],
        ]);

        EmailTemplate::forWorkspace($workspace)->findOrFail($data['email_template_id']);

        if (isset($data['email_provider_id'])) {
            EmailProvider::forWorkspace($workspace)->findOrFail($data['email_provider_id']);
        }

        $campaign = EmailCampaign::create(['workspace_id' => $workspace->id, 'status' => 'draft', ...$data]);

        return response()->json($campaign, 201);
    }

    public function destroyCampaign(Request $request, int $campaign): JsonResponse
    {
        $this->authorizeAbility($request, 'email.manage');
        $model = EmailCampaign::forWorkspace($this->workspace($request))->findOrFail($campaign);
        abort_unless($model->status === 'draft', 422, 'Only draft campaigns can be deleted.');
        $model->delete();

        return response()->json(['ok' => true]);
    }

    public function previewAudience(Request $request, int $campaign): JsonResponse
    {
        $model = EmailCampaign::forWorkspace($this->workspace($request))->findOrFail($campaign);

        return response()->json([
            'eligible' => SendEmailCampaign::audienceQuery($model)->count(),
            'note' => 'Only contacts with an email address, recorded marketing consent and no unsubscribe are included.',
        ]);
    }

    public function sendCampaign(Request $request, int $campaign): JsonResponse
    {
        $this->authorizeAbility($request, 'email.manage');
        $model = EmailCampaign::forWorkspace($this->workspace($request))->findOrFail($campaign);
        abort_unless(in_array($model->status, ['draft', 'scheduled'], true), 422, 'This campaign was already sent.');

        $data = $request->validate(['scheduled_at' => ['nullable', 'date', 'after:now']]);
        $model->update(['status' => 'scheduled', 'scheduled_at' => $data['scheduled_at'] ?? now()]);
        $job = SendEmailCampaign::dispatch($model->id)->onQueue(config('automation.queues.email'));

        if (isset($data['scheduled_at'])) {
            $job->delay(now()->parse($data['scheduled_at']));
        }

        AuditLogger::log('email.campaign_sent', $model);

        return response()->json($model->refresh());
    }

    public function sends(Request $request): JsonResponse
    {
        return response()->json(
            EmailSend::forWorkspace($this->workspace($request))->with('contact:id,username,name,email')
                ->when($request->query('campaign_id'), fn ($query, $id) => $query->where('email_campaign_id', $id))
                ->latest('id')->paginate(50)
        );
    }

    /**
     * Public, signed unsubscribe link included in every email.
     */
    public function unsubscribe(Request $request, Contact $contact, ConsentService $consents): Response
    {
        abort_unless($request->hasValidSignature(), 403);
        $consents->revoke($contact, ConsentType::EmailMarketing, 'unsubscribe_link', 'Clicked unsubscribe link', $request->ip());
        $consents->revoke($contact, ConsentType::EmailTransactional, 'unsubscribe_link', 'Clicked unsubscribe link', $request->ip());

        return response('<html><body style="font-family:sans-serif;text-align:center;padding:60px"><h2>You have been unsubscribed.</h2><p>You will no longer receive these emails.</p></body></html>');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateProvider(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'driver' => [$required, 'in:smtp,log'],
            'name' => [$required, 'string', 'max:80'],
            'from_name' => [$required, 'string', 'max:80'],
            'from_email' => [$required, 'email'],
            'credentials' => ['sometimes', 'array'],
            'credentials.host' => ['required_if:driver,smtp', 'nullable', 'string'],
            'credentials.port' => ['nullable', 'integer'],
            'credentials.username' => ['nullable', 'string'],
            'credentials.password' => ['nullable', 'string'],
            'credentials.encryption' => ['nullable', 'in:tls,ssl,null'],
            'is_default' => ['sometimes', 'boolean'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validateTemplate(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'name' => [$required, 'string', 'max:120'],
            'subject' => [$required, 'string', 'max:200'],
            'body_html' => [$required, 'string', 'max:200000'],
            'body_text' => ['nullable', 'string'],
            'category' => ['sometimes', 'in:marketing,transactional'],
        ]);
    }
}
