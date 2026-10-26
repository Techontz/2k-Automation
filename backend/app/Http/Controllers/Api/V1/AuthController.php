<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Models\User;
use App\Models\WorkspaceInvitation;
use App\Services\AuditLogger;
use App\Services\WorkspaceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly WorkspaceService $workspaces) {}

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', Password::min(10)->letters()->numbers()],
            'workspace_name' => ['nullable', 'string', 'max:120'],
            'invitation_token' => ['nullable', 'string'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => mb_strtolower($data['email']),
            'password' => $data['password'],
        ]);

        $invitation = isset($data['invitation_token'])
            ? WorkspaceInvitation::where('token', $data['invitation_token'])->whereNull('accepted_at')->where('expires_at', '>', now())->first()
            : null;

        if ($invitation && mb_strtolower($invitation->email) === $user->email) {
            $this->workspaces->acceptInvitation($invitation, $user);
        } else {
            $this->workspaces->create($user, $data['workspace_name'] ?? "{$user->name}'s Workspace");
        }

        AuditLogger::log('auth.registered', $user, workspaceId: $user->current_workspace_id);

        return $this->tokenResponse($user, 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', mb_strtolower($data['email']))->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'These credentials do not match our records.']);
        }

        AuditLogger::log('auth.login', $user, workspaceId: $user->current_workspace_id);

        return $this->tokenResponse($user);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()?->delete();

        return response()->json(['ok' => true]);
    }

    public function me(Request $request): UserResource
    {
        return new UserResource($request->user()->load('workspaces'));
    }

    public function updateProfile(Request $request): UserResource
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'email' => ['sometimes', 'email', 'max:190', 'unique:users,email,'.$user->id],
            'current_password' => ['required_with:password', 'current_password'],
            'password' => ['sometimes', Password::min(10)->letters()->numbers()],
        ]);

        $user->update(collect($data)->except('current_password')->all());

        if (isset($data['password'])) {
            $user->tokens()->where('id', '!=', $user->currentAccessToken()?->id)->delete();
            AuditLogger::log('auth.password_changed', $user, workspaceId: $user->current_workspace_id);
        }

        return new UserResource($user->load('workspaces'));
    }

    private function tokenResponse(User $user, int $status = 200): JsonResponse
    {
        $token = $user->createToken('dashboard', ['*'], now()->addDays(30))->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => new UserResource($user->load('workspaces')),
        ], $status);
    }
}
