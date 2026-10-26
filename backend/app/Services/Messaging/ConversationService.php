<?php

namespace App\Services\Messaging;

use App\Models\Channel;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use Illuminate\Support\Str;

class ConversationService
{
    public function forContact(Channel $channel, Contact $contact): Conversation
    {
        return Conversation::firstOrCreate(
            ['channel_id' => $channel->id, 'contact_id' => $contact->id],
            ['workspace_id' => $channel->workspace_id, 'is_simulated' => $channel->is_simulated, 'status' => 'open'],
        );
    }

    public function touchInbound(Conversation $conversation, Message $message): void
    {
        $conversation->forceFill([
            'last_message_at' => $message->created_at,
            'last_message_preview' => Str::limit((string) $message->body, 120),
            'unread_count' => $conversation->unread_count + 1,
            'status' => 'open',
        ])->save();
    }

    public function touchOutbound(Message $message): void
    {
        Conversation::whereKey($message->conversation_id)->update([
            'last_message_at' => now(),
            'last_message_preview' => Str::limit((string) $message->body, 120),
        ]);
    }
}
