<?php

namespace App\Http\Controllers;

use App\Enums\WorkspaceRole;
use App\Models\Workspace;
use Illuminate\Http\Request;

abstract class Controller
{
    protected function workspace(Request $request): Workspace
    {
        return $request->attributes->get('workspace');
    }

    protected function role(Request $request): WorkspaceRole
    {
        return $request->attributes->get('workspace_role');
    }

    /**
     * Abort with 403 unless the member's role grants the ability.
     */
    protected function authorizeAbility(Request $request, string $ability): void
    {
        abort_unless($this->role($request)->allows($ability), 403, 'Your role does not allow this action.');
    }
}
