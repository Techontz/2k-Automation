<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\WorkspaceRole;
use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Services\AuditLogger;
use App\Services\WorkspaceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TeamController extends Controller
{
    public function __construct(private readonly WorkspaceService $workspaces) {}

    public function index(Request $request): JsonResponse
    {
        $workspace = $this->workspace($request);

        return response()->json([
            'members' => $workspace->members()->orderBy('name')->get()->map(fn (User $user): array => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->pivot->role,
                'joined_at' => $user->pivot->created_at,
            ]),
            'invitations' => WorkspaceInvitation::forWorkspace($workspace)->whereNull('accepted_at')->latest()->get(['id', 'email', 'role', 'expires_at', 'created_at']),
        ]);
    }

    public function invite(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'team.manage');
        $workspace = $this->workspace($request);

        $data = $request->validate([
            'email' => ['required', 'email'],
            'role' => ['required', Rule::in(['admin', 'editor', 'agent', 'viewer'])],
        ]);
        $email = mb_strtolower($data['email']);

        $invitation = WorkspaceInvitation::updateOrCreate(
            ['workspace_id' => $workspace->id, 'email' => $email],
            ['role' => $data['role'], 'invited_by' => $request->user()->id, 'token' => Str::random(48), 'expires_at' => now()->addDays(7), 'accepted_at' => null],
        );

        if ($existing = User::where('email', $email)->first()) {
            $this->workspaces->acceptInvitation($invitation, $existing);
            $existing->forceFill(['current_workspace_id' => $existing->getOriginal('current_workspace_id') ?? $workspace->id])->save();
        }

        AuditLogger::log('team.invited', $invitation, ['email' => $email, 'role' => $data['role']]);

        return response()->json([
            'invitation_id' => $invitation->id,
            'added_existing_user' => (bool) $existing,
            'accept_url' => rtrim(config('automation.frontend_url'), '/').'/register?invite='.$invitation->token,
        ], 201);
    }

    public function updateRole(Request $request, User $user): JsonResponse
    {
        $this->authorizeAbility($request, 'team.manage');
        $workspace = $this->workspace($request);
        $data = $request->validate(['role' => ['required', Rule::in(['admin', 'editor', 'agent', 'viewer'])]]);

        abort_if($workspace->owner_id === $user->id, 422, 'The workspace owner role cannot be changed.');
        abort_unless($workspace->members()->whereKey($user->id)->exists(), 404);

        $workspace->members()->updateExistingPivot($user->id, ['role' => $data['role']]);
        AuditLogger::log('team.role_changed', $user, ['role' => $data['role']], $workspace->id);

        return response()->json(['ok' => true]);
    }

    public function remove(Request $request, User $user): JsonResponse
    {
        $workspace = $this->workspace($request);

        if ($user->id !== $request->user()->id) {
            $this->authorizeAbility($request, 'team.manage');
        }

        abort_if($workspace->owner_id === $user->id, 422, 'The workspace owner cannot be removed.');
        $workspace->members()->detach($user->id);
        AuditLogger::log('team.removed', $user, [], $workspace->id);

        return response()->json(['ok' => true]);
    }

    public function revokeInvitation(Request $request, WorkspaceInvitation $invitation): JsonResponse
    {
        $this->authorizeAbility($request, 'team.manage');
        abort_unless($invitation->workspace_id === $this->workspace($request)->id, 404);
        $invitation->delete();

        return response()->json(['ok' => true]);
    }

    /**
     * @return list<array{value: string, abilities: list<string>}>
     */
    public function roles(): array
    {
        return array_map(fn (WorkspaceRole $role): array => ['value' => $role->value, 'abilities' => $role->abilities()], WorkspaceRole::cases());
    }
}
