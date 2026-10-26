<?php

namespace App\Http\Resources;

use App\Models\Conversation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Conversation
 */
class ConversationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'is_simulated' => $this->is_simulated,
            'needs_human' => $this->needs_human,
            'ai_paused' => $this->ai_paused,
            'unread_count' => $this->unread_count,
            'last_message_preview' => $this->last_message_preview,
            'last_message_at' => $this->last_message_at,
            'contact' => new ContactResource($this->whenLoaded('contact')),
            'channel' => $this->whenLoaded('channel', fn () => $this->channel->only(['id', 'name', 'username', 'is_simulated']) + ['platform' => $this->channel->platform->value]),
            'assignee' => $this->whenLoaded('assignee', fn () => $this->assignee?->only(['id', 'name'])),
        ];
    }
}
