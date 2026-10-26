<?php

namespace App\Http\Resources;

use App\Models\Contact;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Contact
 */
class ContactResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'platform' => $this->platform,
            'channel_id' => $this->channel_id,
            'is_simulated' => $this->is_simulated,
            'display_name' => $this->displayName(),
            'name' => $this->name,
            'username' => $this->username,
            'avatar_url' => $this->avatar_url,
            'email' => $this->email,
            'phone' => $this->phone,
            'locale' => $this->locale,
            'custom_fields' => $this->custom_fields ?? (object) [],
            'unsubscribed' => $this->unsubscribed,
            'last_inbound_at' => $this->last_inbound_at,
            'last_interaction_at' => $this->last_interaction_at,
            'messaging_window_open' => $this->last_inbound_at?->greaterThan(now()->subHours(24)) ?? false,
            'tags' => $this->whenLoaded('tags', fn () => $this->tags->map->only(['id', 'name', 'color'])),
            'created_at' => $this->created_at,
        ];
    }
}
