<?php

namespace App\Http\Middleware;

use App\Enums\WorkspaceRole;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Resolves the active workspace from the X-Workspace-Id header (falling back
 * to the user's current workspace) and verifies membership.
 */
class ResolveWorkspace
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $workspaceId = $request->header('X-Workspace-Id') ?: $user?->current_workspace_id;

        $workspace = $workspaceId ? $user?->workspaces()->whereKey($workspaceId)->first() : null;

        if (! $workspace) {
            return response()->json(['message' => 'No workspace selected or access denied.', 'code' => 'workspace_required'], 403);
        }

        $request->attributes->set('workspace', $workspace);
        $request->attributes->set('workspace_role', WorkspaceRole::from($workspace->pivot->role));

        return $next($request);
    }
}
