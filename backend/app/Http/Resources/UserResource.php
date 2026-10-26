<?php

namespace App\Http\Resources;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin User
 */
class UserResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'email' => $this->email,
            'avatar_url' => $this->avatar_url,
            'current_workspace_id' => $this->current_workspace_id,
            'role' => $this->whenPivotLoaded('workspace_user', fn () => $this->pivot->role),
            'workspaces' => WorkspaceResource::collection($this->whenLoaded('workspaces')),
        ];
    }
}
