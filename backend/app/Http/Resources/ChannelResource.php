<?php

namespace App\Http\Resources;

use App\Models\Channel;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Channel
 */
class ChannelResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'platform' => $this->platform->value,
            'platform_label' => $this->platform->label(),
            'capabilities' => $this->platform->capabilities(),
            'is_simulated' => $this->is_simulated,
            'external_id' => $this->external_id,
            'name' => $this->name,
            'username' => $this->username,
            'avatar_url' => $this->avatar_url,
            'status' => $this->status,
            'status_reason' => $this->status_reason,
            'scopes' => $this->scopes ?? [],
            'token_expires_at' => $this->token_expires_at,
            'last_webhook_at' => $this->last_webhook_at,
            'posts_count' => $this->whenCounted('posts'),
            'created_at' => $this->created_at,
        ];
    }
}
