<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\ConsentType;
use App\Http\Controllers\Controller;
use App\Http\Resources\ContactResource;
use App\Http\Resources\MessageResource;
use App\Models\AutomationRun;
use App\Models\Comment;
use App\Models\Contact;
use App\Models\Message;
use App\Models\Tag;
use App\Services\AuditLogger;
use App\Services\Contacts\ConsentService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ContactController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return ContactResource::collection($this->query($request)->with('tags')->latest('last_interaction_at')->paginate((int) $request->query('per_page', 30)));
    }

    public function show(Request $request, int $contact): JsonResponse
    {
        $model = $this->find($request, $contact)->load(['tags', 'channel:id,name,platform,is_simulated']);

        return response()->json([
            'contact' => new ContactResource($model),
            'consents' => $model->consents()->latest('recorded_at')->latest('id')->get(),
            'consent_state' => collect(ConsentType::cases())->mapWithKeys(fn (ConsentType $type): array => [$type->value => $model->hasConsent($type)]),
            'recent_messages' => MessageResource::collection($model->hasMany(Message::class)->latest('id')->limit(20)->get()),
            'runs' => $model->hasMany(AutomationRun::class)->with('automation:id,name')->latest('id')->limit(10)->get(['id', 'automation_id', 'status', 'started_at', 'finished_at']),
        ]);
    }

    public function update(Request $request, int $contact): ContactResource
    {
        $this->authorizeAbility($request, 'contacts.edit');
        $model = $this->find($request, $contact);
        $data = $request->validate([
            'name' => ['sometimes', 'nullable', 'string', 'max:120'],
            'email' => ['sometimes', 'nullable', 'email', 'max:190'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'custom_fields' => ['sometimes', 'array'],
            'unsubscribed' => ['sometimes', 'boolean'],
        ]);

        $model->update($data);

        return new ContactResource($model->load('tags'));
    }

    public function syncTags(Request $request, int $contact): ContactResource
    {
        $this->authorizeAbility($request, 'contacts.edit');
        $model = $this->find($request, $contact);
        $data = $request->validate(['tags' => ['present', 'array'], 'tags.*' => ['string', 'max:60']]);
        $workspaceId = $this->workspace($request)->id;

        $ids = collect($data['tags'])->map(fn (string $name): int => Tag::firstOrCreate(['workspace_id' => $workspaceId, 'name' => trim($name)])->id);
        $model->tags()->sync($ids);

        return new ContactResource($model->load('tags'));
    }

    public function recordConsent(Request $request, int $contact, ConsentService $consents): JsonResponse
    {
        $this->authorizeAbility($request, 'contacts.edit');
        $model = $this->find($request, $contact);
        $data = $request->validate([
            'type' => ['required', Rule::enum(ConsentType::class)],
            'status' => ['required', 'in:granted,revoked'],
            'evidence' => ['required', 'string', 'max:1000'],
        ]);

        $type = ConsentType::from($data['type']);
        $evidence = $data['evidence'].' (recorded by '.$request->user()->email.')';
        $consent = $data['status'] === 'granted'
            ? $consents->grant($model, $type, 'manual', $evidence, $request->ip())
            : $consents->revoke($model, $type, 'manual', $evidence, $request->ip());

        AuditLogger::log('contact.consent_'.$data['status'], $model, ['type' => $type->value]);

        return response()->json($consent, 201);
    }

    /**
     * GDPR erasure: removes the contact and all their messages and comments.
     */
    public function destroy(Request $request, int $contact): JsonResponse
    {
        $this->authorizeAbility($request, 'settings.manage');
        $model = $this->find($request, $contact);
        AuditLogger::log('contact.erased', $model, ['username' => $model->username]);
        $model->hasMany(Message::class)->delete();
        $model->hasMany(Comment::class)->delete();
        $model->delete();

        return response()->json(['ok' => true]);
    }

    public function export(Request $request): StreamedResponse
    {
        $this->authorizeAbility($request, 'settings.manage');
        $query = $this->query($request)->with('tags');
        AuditLogger::log('contacts.exported');

        return response()->streamDownload(function () use ($query): void {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['id', 'platform', 'username', 'name', 'email', 'phone', 'tags', 'last_interaction_at', 'created_at']);
            $query->chunkById(500, function ($contacts) use ($out): void {
                foreach ($contacts as $contact) {
                    fputcsv($out, [$contact->id, $contact->platform, $contact->username, $contact->name, $contact->email, $contact->phone, $contact->tags->pluck('name')->implode('|'), $contact->last_interaction_at, $contact->created_at]);
                }
            });
            fclose($out);
        }, 'contacts-'.now()->format('Y-m-d').'.csv', ['Content-Type' => 'text/csv']);
    }

    /**
     * @return Builder<Contact>
     */
    private function query(Request $request): Builder
    {
        return Contact::forWorkspace($this->workspace($request))
            ->when($request->query('search'), fn ($query, $search) => $query->where(fn ($q) => $q->where('username', 'like', "%{$search}%")->orWhere('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%")))
            ->when($request->query('tag_id'), fn ($query, $tagId) => $query->whereHas('tags', fn ($tags) => $tags->where('tags.id', $tagId)))
            ->when($request->query('platform'), fn ($query, $platform) => $query->where('platform', $platform))
            ->when($request->query('has_email'), fn ($query) => $query->whereNotNull('email'))
            ->when($request->has('simulated'), fn ($query) => $query->where('is_simulated', $request->boolean('simulated')));
    }

    private function find(Request $request, int $id): Contact
    {
        return Contact::forWorkspace($this->workspace($request))->findOrFail($id);
    }
}
