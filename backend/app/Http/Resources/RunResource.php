<?php

namespace App\Http\Resources;

use App\Models\AutomationRun;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin AutomationRun
 */
class RunResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'automation_id' => $this->automation_id,
            'automation' => $this->whenLoaded('automation', fn () => $this->automation->only(['id', 'name'])),
            'contact' => new ContactResource($this->whenLoaded('contact')),
            'is_simulated' => $this->is_simulated,
            'status' => $this->status->value,
            'current_node_id' => $this->current_node_id,
            'waiting_for' => $this->waiting_for,
            'resume_at' => $this->resume_at,
            'context' => $this->context,
            'error' => $this->error,
            'started_at' => $this->started_at,
            'finished_at' => $this->finished_at,
            'steps' => $this->whenLoaded('steps'),
        ];
    }
}
