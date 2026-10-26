<?php

namespace App\Models;

use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['workspace_id', 'invited_by', 'email', 'role', 'token', 'accepted_at', 'expires_at'])]
#[Hidden(['token'])]
class WorkspaceInvitation extends Model
{
    use BelongsToWorkspace;

    protected function casts(): array
    {
        return [
            'accepted_at' => 'datetime',
            'expires_at' => 'datetime',
        ];
    }
}
