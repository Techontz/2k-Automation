<?php

namespace App\Http\Resources;

use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Workspace
 */
class WorkspaceResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'slug' => $this->slug,
            'timezone' => $this->timezone,
            'default_language' => $this->default_language,
            'settings' => $this->settings ?? (object) [],
            'onboarded_at' => $this->onboarded_at,
            'role' => $this->whenPivotLoaded('workspace_user', fn () => $this->pivot->role),
        ];
    }
}
