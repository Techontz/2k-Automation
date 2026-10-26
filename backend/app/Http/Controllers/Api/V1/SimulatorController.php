<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\RunStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\ChannelResource;
use App\Http\Resources\MessageResource;
use App\Http\Resources\RunResource;
use App\Jobs\ExecuteAutomationRun;
use App\Models\AutomationRun;
use App\Models\Channel;
use App\Models\Comment;
use App\Models\Contact;
use App\Models\Message;
use App\Models\WebhookEvent;
use App\Services\Automation\FlowExecutor;
use App\Services\Simulator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Test environment: fire fake comments/DMs through the real pipeline and
 * inspect what the engine did. Everything is flagged as simulated.
 */
class SimulatorController extends Controller
{
    public function __construct(private readonly Simulator $simulator) {}

    public function state(Request $request): JsonResponse
    {
        $channel = $this->simulator->channel($this->workspace($request));

        return response()->json([
            'channel' => new ChannelResource($channel),
            'posts' => $channel->posts()->orderBy('id')->get(['id', 'external_id', 'media_type', 'caption', 'published_at']),
        ]);
    }

    public function comment(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'simulate');
        $data = $request->validate([
            'post_id' => ['nullable', 'integer'],
            'username' => ['required', 'string', 'max:40', 'regex:/^@?[\w.]+$/'],
            'text' => ['required', 'string', 'max:500'],
        ]);

        $result = $this->simulator->comment($this->workspace($request), $data['post_id'] ?? null, $data['username'], $data['text']);

        return response()->json($this->timeline($request, $result['sender_id'], $result['comment_id']), 201);
    }

    public function message(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'simulate');
        $data = $request->validate([
            'username' => ['required', 'string', 'max:40', 'regex:/^@?[\w.]+$/'],
            'text' => ['required', 'string', 'max:1000'],
            'story_reply' => ['sometimes', 'boolean'],
        ]);

        $result = $this->simulator->message($this->workspace($request), $data['username'], $data['text'], $data['story_reply'] ?? false);

        return response()->json($this->timeline($request, $result['sender_id']), 201);
    }

    public function conversation(Request $request): JsonResponse
    {
        $data = $request->validate(['username' => ['required', 'string', 'max:40']]);
        $channel = $this->simulator->channel($this->workspace($request));
        $senderId = 'sim_user_'.substr(sha1($this->workspace($request)->id.'|'.mb_strtolower(ltrim($data['username'], '@'))), 0, 16);

        return response()->json($this->timeline($request, $senderId));
    }

    public function fastForward(Request $request, int $run): JsonResponse
    {
        $this->authorizeAbility($request, 'simulate');
        $model = AutomationRun::forWorkspace($this->workspace($request))->where('is_simulated', true)->findOrFail($run);

        if ($model->status === RunStatus::Waiting && $model->waiting_for === 'delay') {
            $model->forceFill(['resume_at' => now()->subSecond()])->save();
            ExecuteAutomationRun::dispatchSync($model->id);
        } elseif ($model->status === RunStatus::Waiting) {
            app(FlowExecutor::class)->resume($model, null);
        }

        return response()->json(['run' => new RunResource($model->refresh()->load('steps'))]);
    }

    public function reset(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'simulate');
        $workspace = $this->workspace($request);
        $channelIds = Channel::forWorkspace($workspace)->where('is_simulated', true)->pluck('id');

        AutomationRun::forWorkspace($workspace)->where('is_simulated', true)->delete();
        Message::whereIn('channel_id', $channelIds)->delete();
        Comment::whereIn('channel_id', $channelIds)->delete();
        Contact::whereIn('channel_id', $channelIds)->delete();
        WebhookEvent::whereIn('channel_id', $channelIds)->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * Everything the simulated person would see, plus the engine's run log.
     *
     * @return array<string, mixed>
     */
    private function timeline(Request $request, string $senderId, ?string $commentId = null): array
    {
        $channel = $this->simulator->channel($this->workspace($request));
        $contact = Contact::where('channel_id', $channel->id)->where('external_id', $senderId)->with('tags')->first();

        if (! $contact) {
            return ['contact' => null, 'messages' => [], 'comments' => [], 'runs' => [], 'event' => null];
        }

        $event = $commentId ? WebhookEvent::where('dedupe_key', 'like', '%:'.$commentId)->latest('id')->first(['id', 'status', 'outcome', 'error']) : null;

        return [
            'contact' => $contact->only(['id', 'username', 'email']) + ['tags' => $contact->tags->pluck('name')],
            'event' => $event,
            'comments' => Comment::where('contact_id', $contact->id)->latest('id')->limit(10)->get(['id', 'text', 'matched_keyword', 'public_replied_at', 'private_replied_at', 'created_at']),
            'messages' => MessageResource::collection(Message::where('contact_id', $contact->id)->orderBy('id')->limit(200)->get()),
            'runs' => RunResource::collection(AutomationRun::where('contact_id', $contact->id)->with(['automation:id,name', 'steps'])->latest('id')->limit(5)->get()),
        ];
    }
}
