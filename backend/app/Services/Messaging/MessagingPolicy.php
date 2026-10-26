<?php

namespace App\Services\Messaging;

use App\Enums\Platform;
use App\Models\Channel;
use App\Models\Comment;
use App\Models\Contact;
use Illuminate\Support\Carbon;

/**
 * Single gate every outbound message passes through. Encodes each platform's
 * official messaging rules so the engine can never send outside them.
 */
class MessagingPolicy
{
    public function forCommentReply(Channel $channel, Comment $comment): PolicyDecision
    {
        if ($blocked = $this->channelProblem($channel)) {
            return PolicyDecision::deny($blocked);
        }

        if (! $channel->platform->capabilities()['comment_reply']) {
            return PolicyDecision::deny("{$channel->platform->label()} does not support public comment replies.");
        }

        return PolicyDecision::allow('comment_reply');
    }

    /**
     * Decide how (or whether) a direct message may reach this contact right now.
     * Order of preference: open standard window → unused private reply → human agent tag.
     */
    public function forDirectMessage(Channel $channel, Contact $contact, ?Comment $comment = null, bool $sentByHuman = false): PolicyDecision
    {
        if ($blocked = $this->channelProblem($channel)) {
            return PolicyDecision::deny($blocked);
        }

        if ($contact->unsubscribed) {
            return PolicyDecision::deny('Contact has opted out of messages.');
        }

        $capabilities = $channel->platform->capabilities();

        if (! $capabilities['dm'] && ! $capabilities['private_reply']) {
            return PolicyDecision::deny("{$channel->platform->label()} does not allow third-party apps to send direct messages.");
        }

        if ($capabilities['dm'] && $this->withinHours($contact->last_inbound_at, config('automation.windows.standard_hours'))) {
            return PolicyDecision::allow('response');
        }

        if ($comment !== null && $capabilities['private_reply']) {
            if ($comment->private_replied_at !== null) {
                return PolicyDecision::deny('A private reply was already sent for this comment. Further messages need the person to reply first.');
            }

            if (! $this->withinHours($comment->commented_at, config('automation.windows.private_reply_hours'))) {
                return PolicyDecision::deny('The comment is older than the 7-day private reply window.');
            }

            return PolicyDecision::allow('private_reply');
        }

        if ($sentByHuman && in_array($channel->platform, [Platform::Instagram, Platform::Facebook], true)
            && $this->withinHours($contact->last_inbound_at, config('automation.windows.human_agent_hours'))) {
            return PolicyDecision::allow('human_agent', 'HUMAN_AGENT');
        }

        if ($channel->platform === Platform::WhatsApp) {
            return PolicyDecision::deny('Outside the 24-hour customer service window. Send an approved WhatsApp template instead.');
        }

        return PolicyDecision::deny($contact->last_inbound_at === null
            ? 'This person has not messaged you yet. Messages can only be sent after they start a conversation or comment.'
            : 'Outside the 24-hour messaging window since their last message.');
    }

    public function forTemplate(Channel $channel, Contact $contact): PolicyDecision
    {
        if ($blocked = $this->channelProblem($channel)) {
            return PolicyDecision::deny($blocked);
        }

        if ($contact->unsubscribed) {
            return PolicyDecision::deny('Contact has opted out of messages.');
        }

        return $channel->platform->capabilities()['templates'] && $channel->platform !== Platform::Email
            ? PolicyDecision::allow('template')
            : PolicyDecision::deny("{$channel->platform->label()} does not support message templates.");
    }

    private function channelProblem(Channel $channel): ?string
    {
        return $channel->isActive() ? null : "Channel is {$channel->status}; reconnect it to send messages.";
    }

    private function withinHours(?Carbon $moment, int $hours): bool
    {
        return $moment !== null && $moment->greaterThan(now()->subHours($hours));
    }
}
