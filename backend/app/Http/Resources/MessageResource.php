<?php

namespace App\Http\Resources;

use App\Models\Message;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Message
 */
class MessageResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'conversation_id' => $this->conversation_id,
            'direction' => $this->direction,
            'kind' => $this->kind->value,
            'source' => $this->source,
            'body' => $this->body,
            'payload' => $this->payload,
            'status' => $this->status->value,
            'error_message' => $this->error_message,
            'is_simulated' => $this->is_simulated,
            'automation_run_id' => $this->automation_run_id,
            'sender' => $this->whenLoaded('sender', fn () => $this->sender?->only(['id', 'name'])),
            'created_at' => $this->created_at,
        ];
    }
}
