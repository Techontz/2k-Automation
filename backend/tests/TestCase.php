<?php

namespace Tests;

use App\Enums\WorkspaceRole;
use App\Models\User;
use App\Models\Workspace;
use App\Services\WorkspaceService;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Create a user who owns (or holds the given role in) a fresh workspace.
     *
     * @return array{0: User, 1: Workspace}
     */
    protected function workspaceMember(WorkspaceRole $role = WorkspaceRole::Owner): array
    {
        $owner = User::factory()->create();
        $workspace = app(WorkspaceService::class)->create($owner, 'Test Workspace');

        if ($role === WorkspaceRole::Owner) {
            return [$owner, $workspace];
        }

        $member = User::factory()->create(['current_workspace_id' => $workspace->id]);
        $workspace->members()->attach($member->id, ['role' => $role->value]);

        return [$member, $workspace];
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return array<string, string>
     */
    protected function metaSignatureHeaders(array $payload): array
    {
        return ['X-Hub-Signature-256' => 'sha256='.hash_hmac('sha256', json_encode($payload), (string) config('services.meta.app_secret'))];
    }
}
