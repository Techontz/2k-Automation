<?php

namespace App\Services\Ai;

use App\Models\Conversation;
use App\Models\Message;
use App\Services\Messaging\MessageDispatcher;
use App\Services\Platforms\OutboundMessage;

/**
 * Answers inbound DMs that no automation handled, when AI auto-reply is on.
 */
class AutoReplyService
{
    public function __construct(
        private readonly AiResponder $ai,
        private readonly MessageDispatcher $dispatcher,
    ) {}

    public function replyTo(Conversation $conversation, Message $inbound): ?Message
    {
        $reply = $this->ai->respond($conversation->workspace, $conversation, (string) $inbound->body);

        if ($reply->shouldHandover) {
            $conversation->forceFill(['needs_human' => true])->save();

            return null;
        }

        return $this->dispatcher->sendDirect($conversation->channel, $conversation->contact, new OutboundMessage($reply->text), null, ['source' => 'ai']);
    }
}
