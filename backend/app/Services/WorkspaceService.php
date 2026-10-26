<?php

namespace App\Services;

use App\Enums\WorkspaceRole;
use App\Models\AiSetting;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WorkspaceService
{
    public function create(User $owner, string $name): Workspace
    {
        return DB::transaction(function () use ($owner, $name): Workspace {
            $workspace = Workspace::create([
                'name' => $name,
                'slug' => Str::slug($name).'-'.Str::lower(Str::random(6)),
                'owner_id' => $owner->id,
            ]);

            $workspace->members()->attach($owner->id, ['role' => WorkspaceRole::Owner->value]);
            $owner->forceFill(['current_workspace_id' => $workspace->id])->save();
            AiSetting::forWorkspaceOrDefault($workspace);

            return $workspace;
        });
    }

    public function acceptInvitation(WorkspaceInvitation $invitation, User $user): void
    {
        DB::transaction(function () use ($invitation, $user): void {
            $invitation->workspace->members()->syncWithoutDetaching([$user->id => ['role' => $invitation->role]]);
            $invitation->forceFill(['accepted_at' => now()])->save();
            $user->forceFill(['current_workspace_id' => $invitation->workspace_id])->save();
        });
    }
}
