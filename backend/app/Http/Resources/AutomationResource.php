<?php

namespace App\Http\Resources;

use App\Models\Automation;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Automation
 */
class AutomationResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'description' => $this->description,
            'status' => $this->status->value,
            'trigger_type' => $this->trigger_type->value,
            'trigger_label' => $this->trigger_type->label(),
            'trigger_config' => (object) ($this->trigger_config ?? []),
            'flow' => $this->when($request->routeIs('*.automations.show', '*.automations.update', '*.automations.store', '*.automations.duplicate'), $this->flow),
            'priority' => $this->priority,
            'runs_count' => $this->runs_count,
            'completed_count' => $this->completed_count,
            'failed_count' => $this->failed_count,
            'last_run_at' => $this->last_run_at,
            'updated_at' => $this->updated_at,
            'created_at' => $this->created_at,
        ];
    }
}
