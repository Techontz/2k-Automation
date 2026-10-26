<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\ConversationResource;
use App\Http\Resources\MessageResource;
use App\Models\Conversation;
use App\Services\Ai\AiResponder;
use App\Services\Messaging\MessageDispatcher;
use App\Services\Messaging\MessagingPolicy;
use App\Services\Platforms\OutboundMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ConversationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $conversations = Conversation::forWorkspace($this->workspace($request))
            ->with(['contact.tags', 'channel', 'assignee'])
            ->when($request->query('status', 'open') !== 'all', fn ($query) => $query->where('status', $request->query('status', 'open')))
            ->when($request->query('filter') === 'mine', fn ($query) => $query->where('assigned_user_id', $user->id))
            ->when($request->query('filter') === 'unassigned', fn ($query) => $query->whereNull('assigned_user_id'))
            ->when($request->query('filter') === 'needs_human', fn ($query) => $query->where('needs_human', true))
            ->when($request->query('channel_id'), fn ($query, $id) => $query->where('channel_id', $id))
            ->when($request->has('simulated'), fn ($query) => $query->where('is_simulated', $request->boolean('simulated')))
            ->when($request->query('search'), fn ($query, $search) => $query->whereHas('contact', fn ($contacts) => $contacts->where('username', 'like', "%{$search}%")->orWhere('name', 'like', "%{$search}%")->orWhere('email', 'like', "%{$search}%")))
            ->orderByDesc('last_message_at')
            ->paginate(30);

        return ConversationResource::collection($conversations);
    }

    public function show(Request $request, int $conversation, MessagingPolicy $policy): JsonResponse
    {
        $model = $this->find($request, $conversation)->load(['contact.tags', 'channel', 'assignee']);
        $model->forceFill(['unread_count' => 0])->save();
        $decision = $policy->forDirectMessage($model->channel, $model->contact, null, sentByHuman: true);

        return response()->json([
            'conversation' => new ConversationResource($model),
            'messages' => MessageResource::collection($model->messages()->with('sender:id,name')->orderBy('id')->limit(300)->get()),
            'reply_policy' => ['allowed' => $decision->allowed, 'mode' => $decision->mode, 'reason' => $decision->reason],
        ]);
    }

    public function reply(Request $request, int $conversation, MessageDispatcher $dispatcher): MessageResource
    {
        $this->authorizeAbility($request, 'inbox.reply');
        $model = $this->find($request, $conversation)->load(['channel', 'contact']);
        $data = $request->validate([
            'text' => ['required', 'string', 'max:2000'],
            'buttons' => ['sometimes', 'array', 'max:3'],
            'buttons.*.title' => ['required', 'string', 'max:20'],
            'buttons.*.url' => ['required', 'url'],
        ]);

        $message = $dispatcher->sendDirect($model->channel, $model->contact, new OutboundMessage($data['text'], $data['buttons'] ?? []), null, [
            'source' => 'user',
            'user_id' => $request->user()->id,
        ]);

        if ($model->assigned_user_id === null) {
            $model->forceFill(['assigned_user_id' => $request->user()->id])->save();
        }

        return new MessageResource($message->load('sender:id,name'));
    }

    public function update(Request $request, int $conversation): ConversationResource
    {
        $this->authorizeAbility($request, 'inbox.reply');
        $model = $this->find($request, $conversation);
        $workspace = $this->workspace($request);

        $data = $request->validate([
            'status' => ['sometimes', 'in:open,closed,snoozed'],
            'assigned_user_id' => ['sometimes', 'nullable', 'integer'],
            'ai_paused' => ['sometimes', 'boolean'],
            'needs_human' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['assigned_user_id'])) {
            abort_unless($workspace->members()->whereKey($data['assigned_user_id'])->exists(), 422, 'That user is not in this workspace.');
        }

        if (($data['status'] ?? null) === 'closed') {
            $data['needs_human'] = false;
        }

        $model->update($data);

        return new ConversationResource($model->load(['contact.tags', 'channel', 'assignee']));
    }

    public function suggest(Request $request, int $conversation, AiResponder $ai): JsonResponse
    {
        $model = $this->find($request, $conversation);
        $lastInbound = $model->messages()->where('direction', 'in')->latest('id')->first();

        if (! $lastInbound) {
            return response()->json(['message' => 'No incoming message to reply to.'], 422);
        }

        $reply = $ai->respond($this->workspace($request), $model, (string) $lastInbound->body, 'Draft a reply for a human agent to review.');

        return response()->json([
            'suggestion' => $reply->text,
            'confidence' => $reply->confidence,
            'language' => $reply->language,
            'handover' => $reply->shouldHandover,
            'reason' => $reply->handoverReason,
            'provider' => $reply->provider,
        ]);
    }

    private function find(Request $request, int $id): Conversation
    {
        return Conversation::forWorkspace($this->workspace($request))->findOrFail($id);
    }
}
