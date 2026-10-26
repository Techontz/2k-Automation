<?php

namespace App\Services\Webhooks;

use App\Enums\MessageKind;
use App\Enums\MessageStatus;
use App\Enums\RunStatus;
use App\Models\AiSetting;
use App\Models\AutomationRun;
use App\Models\Channel;
use App\Models\Comment;
use App\Models\Contact;
use App\Models\Message;
use App\Models\Post;
use App\Models\WebhookEvent;
use App\Services\Ai\AutoReplyService;
use App\Services\Automation\FlowExecutor;
use App\Services\Automation\TriggerMatcher;
use App\Services\Messaging\ConversationService;

/**
 * Applies an inbound event to the data model and hands it to the automation engine.
 */
class EventIngestor
{
    public function __construct(
        private readonly TriggerMatcher $triggers,
        private readonly FlowExecutor $executor,
        private readonly ConversationService $conversations,
        private readonly AutoReplyService $autoReply,
    ) {}

    /**
     * @return string Outcome summary stored on the webhook event.
     */
    public function ingest(InboundEvent $event, WebhookEvent $webhookEvent): string
    {
        $channel = Channel::query()
            ->where('platform', $event->platform)
            ->where('external_id', $event->accountId)
            ->where('is_simulated', $webhookEvent->is_simulated)
            ->where('status', 'connected')
            ->first();

        if (! $channel) {
            return 'ignored: no connected channel for account '.$event->accountId;
        }

        $webhookEvent->forceFill(['channel_id' => $channel->id])->save();
        $channel->forceFill(['last_webhook_at' => now()])->save();

        if ($event->senderId !== null && $event->senderId === $channel->external_id) {
            return 'ignored: event from own account';
        }

        return match ($event->type) {
            InboundEvent::Comment => $this->comment($channel, $event, $webhookEvent),
            InboundEvent::Message, InboundEvent::Postback => $event->isEcho ? 'ignored: echo' : $this->message($channel, $event, $webhookEvent),
            InboundEvent::Status => $this->status($channel, $event),
            default => 'ignored: unknown type',
        };
    }

    private function comment(Channel $channel, InboundEvent $event, WebhookEvent $webhookEvent): string
    {
        $contact = $this->contact($channel, $event, inbound: false);
        $post = $event->mediaId ? Post::firstOrCreate(
            ['channel_id' => $channel->id, 'external_id' => $event->mediaId],
            ['workspace_id' => $channel->workspace_id, 'media_type' => $event->mediaType ?? 'post'],
        ) : null;

        $comment = Comment::firstOrCreate(
            ['channel_id' => $channel->id, 'external_id' => $event->externalId],
            [
                'workspace_id' => $channel->workspace_id,
                'post_id' => $post?->id,
                'contact_id' => $contact?->id,
                'parent_external_id' => $event->parentId,
                'is_simulated' => $channel->is_simulated,
                'text' => (string) $event->text,
                'commented_at' => $event->occurredAt ?? now(),
            ],
        );

        if (! $comment->wasRecentlyCreated) {
            return 'ignored: duplicate comment';
        }

        $match = $this->triggers->matchComment($channel, $comment);

        if (! $match || ! $contact) {
            return 'stored comment; no automation matched';
        }

        $comment->forceFill(['matched_keyword' => $match->keyword])->save();
        $run = $this->executor->start($match->automation, $contact, [
            'type' => 'comment',
            'text' => $comment->text,
            'keyword' => $match->keyword,
            'post_external_id' => $event->mediaId,
        ], comment: $comment, webhookEventId: $webhookEvent->id);

        return "started run #{$run->id} for automation #{$match->automation->id}";
    }

    private function message(Channel $channel, InboundEvent $event, WebhookEvent $webhookEvent): string
    {
        $contact = $this->contact($channel, $event, inbound: true);

        if (! $contact) {
            return 'ignored: message without sender';
        }

        $conversation = $this->conversations->forContact($channel, $contact);
        $message = Message::firstOrCreate(
            ['channel_id' => $channel->id, 'external_id' => $event->externalId, 'direction' => 'in'],
            [
                'workspace_id' => $channel->workspace_id,
                'conversation_id' => $conversation->id,
                'contact_id' => $contact->id,
                'is_simulated' => $channel->is_simulated,
                'kind' => MessageKind::Dm,
                'source' => 'contact',
                'body' => $event->text,
                'payload' => array_filter(['postback' => $event->postbackPayload, 'story_reply' => $event->isStoryReply ?: null, ...$event->extra]) ?: null,
                'status' => MessageStatus::Received,
            ],
        );

        if (! $message->wasRecentlyCreated) {
            return 'ignored: duplicate message';
        }

        $this->conversations->touchInbound($conversation, $message);

        $waiting = AutomationRun::query()
            ->where('contact_id', $contact->id)
            ->where('status', RunStatus::Waiting)
            ->whereIn('waiting_for', ['reply', 'email'])
            ->latest('id')
            ->first();

        if ($waiting) {
            $this->executor->resume($waiting, (string) $event->text);

            return "resumed run #{$waiting->id}";
        }

        $match = $this->triggers->matchMessage($channel, $contact, (string) $event->text, $event->isStoryReply, $event->postbackPayload);

        if ($match) {
            $run = $this->executor->start($match->automation, $contact, [
                'type' => $event->isStoryReply ? 'story_reply' : 'dm',
                'text' => $event->text,
                'keyword' => $match->keyword,
            ], conversation: $conversation, webhookEventId: $webhookEvent->id);

            return "started run #{$run->id} for automation #{$match->automation->id}";
        }

        $settings = AiSetting::forWorkspaceOrDefault($channel->workspace);

        if ($settings->enabled && $settings->auto_reply_dms && ! $conversation->ai_paused && ! $conversation->needs_human) {
            $this->autoReply->replyTo($conversation->fresh(), $message);

            return 'answered by AI assistant';
        }

        return 'stored message';
    }

    private function status(Channel $channel, InboundEvent $event): string
    {
        $externalId = $event->extra['message_id'] ?? $event->externalId;
        $status = match ($event->text) {
            'read' => MessageStatus::Read,
            'delivered' => MessageStatus::Delivered,
            'failed' => MessageStatus::Failed,
            default => null,
        };

        if ($status) {
            Message::where('channel_id', $channel->id)->where('external_id', $externalId)->where('direction', 'out')->update(['status' => $status]);
        }

        return 'status updated';
    }

    private function contact(Channel $channel, InboundEvent $event, bool $inbound): ?Contact
    {
        if (! $event->senderId) {
            return null;
        }

        $contact = Contact::firstOrNew(['channel_id' => $channel->id, 'external_id' => $event->senderId]);
        $contact->fill([
            'workspace_id' => $channel->workspace_id,
            'platform' => $channel->platform->value,
            'is_simulated' => $channel->is_simulated,
            'username' => $event->senderUsername ?? $contact->username,
            'name' => $event->senderName ?? $contact->name,
            'phone' => $event->extra['phone'] ?? $contact->phone,
            'last_interaction_at' => now(),
        ]);

        if ($inbound) {
            $contact->last_inbound_at = $event->occurredAt ?? now();
        }

        $contact->save();

        return $contact;
    }
}
