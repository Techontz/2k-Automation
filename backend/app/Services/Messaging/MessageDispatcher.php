<?php

namespace App\Services\Messaging;

use App\Enums\MessageKind;
use App\Enums\MessageStatus;
use App\Models\Channel;
use App\Models\Comment;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Services\Platforms\OutboundMessage;
use App\Services\Platforms\PlatformClientFactory;
use App\Services\Platforms\PlatformException;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Records every outbound message, runs it through MessagingPolicy and the
 * platform client, and keeps conversation / comment state in sync.
 *
 * Retryable platform errors are re-thrown so the calling job can back off.
 */
class MessageDispatcher
{
    public function __construct(
        private readonly MessagingPolicy $policy,
        private readonly PlatformClientFactory $clients,
        private readonly ConversationService $conversations,
    ) {}

    /**
     * @param  array{source?: string, automation_run_id?: int|null, user_id?: int|null}  $meta
     */
    public function replyToComment(Comment $comment, string $text, array $meta = []): Message
    {
        $channel = $comment->channel;
        $message = $this->record($channel, $comment->contact, null, $comment, MessageKind::CommentReply, $text, [], $meta);
        $decision = $this->policy->forCommentReply($channel, $comment);

        if (! $decision->allowed) {
            return $this->block($message, $decision->reason);
        }

        return $this->attempt($message, function () use ($channel, $comment, $text, $message): void {
            $result = $this->clients->for($channel)->replyToComment($channel, $comment->external_id, $text);
            $comment->forceFill(['public_replied_at' => now()])->save();
            $message->external_id = $result->externalId;
        });
    }

    /**
     * Send a DM, automatically using the private-reply route when the contact
     * reached us through a comment and no standard window is open.
     *
     * @param  array{source?: string, automation_run_id?: int|null, user_id?: int|null}  $meta
     */
    public function sendDirect(Channel $channel, Contact $contact, OutboundMessage $outbound, ?Comment $comment = null, array $meta = []): Message
    {
        $sentByHuman = ($meta['source'] ?? null) === 'user';
        $decision = $this->policy->forDirectMessage($channel, $contact, $comment, $sentByHuman);
        $conversation = $this->conversations->forContact($channel, $contact);
        $kind = $decision->mode === 'private_reply' ? MessageKind::PrivateReply : MessageKind::Dm;
        $message = $this->record($channel, $contact, $conversation, $kind === MessageKind::PrivateReply ? $comment : null, $kind, $outbound->text, $outbound->toArray(), $meta);

        if (! $decision->allowed) {
            return $this->block($message, $decision->reason);
        }

        return $this->attempt($message, function () use ($channel, $contact, $outbound, $comment, $decision, $message): void {
            $client = $this->clients->for($channel);

            if ($decision->mode === 'private_reply') {
                $this->throttlePrivateReplies($channel);
                $result = $client->sendPrivateReply($channel, $comment->external_id, $outbound);
                $comment->forceFill(['private_replied_at' => now()])->save();
            } else {
                $result = $client->sendMessage($channel, $contact->external_id, $outbound, $decision->tag);
            }

            $message->external_id = $result->externalId;
        });
    }

    /**
     * Instagram caps private replies at 750 per hour per account; stay under it
     * proactively so a viral Reel queues replies instead of tripping the API limit.
     */
    private function throttlePrivateReplies(Channel $channel): void
    {
        $key = "private-replies:{$channel->id}";
        $limit = (int) config('automation.limits.private_replies_per_hour');

        if (RateLimiter::tooManyAttempts($key, $limit)) {
            throw new PlatformException('Private reply hourly limit reached; will retry automatically.', PlatformException::RateLimited, 'local_private_reply_limit', RateLimiter::availableIn($key) + 5);
        }

        RateLimiter::hit($key, 3600);
    }

    /**
     * @param  list<string>  $parameters
     * @param  array{source?: string, automation_run_id?: int|null, user_id?: int|null}  $meta
     */
    public function sendTemplate(Channel $channel, Contact $contact, string $template, string $language, array $parameters = [], array $meta = []): Message
    {
        $conversation = $this->conversations->forContact($channel, $contact);
        $message = $this->record($channel, $contact, $conversation, null, MessageKind::Template, "[Template: {$template}]", compact('template', 'language', 'parameters'), $meta);
        $decision = $this->policy->forTemplate($channel, $contact);

        if (! $decision->allowed) {
            return $this->block($message, $decision->reason);
        }

        return $this->attempt($message, function () use ($channel, $contact, $template, $language, $parameters, $message): void {
            $message->external_id = $this->clients->for($channel)->sendTemplate($channel, $contact->external_id, $template, $language, $parameters)->externalId;
        });
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  array{source?: string, automation_run_id?: int|null, user_id?: int|null}  $meta
     */
    private function record(Channel $channel, ?Contact $contact, ?Conversation $conversation, ?Comment $comment, MessageKind $kind, string $body, array $payload, array $meta): Message
    {
        return Message::create([
            'workspace_id' => $channel->workspace_id,
            'channel_id' => $channel->id,
            'contact_id' => $contact?->id,
            'conversation_id' => $conversation?->id,
            'comment_id' => $comment?->id,
            'automation_run_id' => $meta['automation_run_id'] ?? null,
            'sent_by_user_id' => $meta['user_id'] ?? null,
            'is_simulated' => $channel->is_simulated,
            'direction' => 'out',
            'kind' => $kind,
            'source' => $meta['source'] ?? 'automation',
            'body' => $body,
            'payload' => $payload ?: null,
            'status' => MessageStatus::Queued,
        ]);
    }

    private function block(Message $message, ?string $reason): Message
    {
        $message->forceFill([
            'status' => MessageStatus::Blocked,
            'error_code' => 'policy',
            'error_message' => $reason,
        ])->save();

        return $message;
    }

    private function attempt(Message $message, callable $send): Message
    {
        try {
            $send();
            $message->forceFill(['status' => MessageStatus::Sent, 'sent_at' => now()])->save();

            if ($message->conversation_id) {
                $this->conversations->touchOutbound($message);
            }
        } catch (PlatformException $exception) {
            $message->forceFill([
                'status' => $exception->category === PlatformException::Policy ? MessageStatus::Blocked : MessageStatus::Failed,
                'error_code' => $exception->platformCode ?? $exception->category,
                'error_message' => $exception->getMessage(),
            ])->save();

            if ($exception->category === PlatformException::Auth) {
                Channel::whereKey($message->channel_id)->update(['status' => 'expired', 'status_reason' => $exception->getMessage()]);
            }

            if ($exception->isRetryable()) {
                throw $exception;
            }
        }

        return $message;
    }
}
