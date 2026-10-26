<?php

namespace Tests\Feature;

use App\Enums\WorkspaceRole;
use App\Models\Automation;
use App\Models\Channel;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuthAndTenancyTest extends TestCase
{
    use RefreshDatabase;

    public function test_registration_creates_workspace_and_returns_token(): void
    {
        $response = $this->postJson('/api/v1/auth/register', [
            'name' => 'Toty Saito',
            'email' => 'Toty@Example.com',
            'password' => 'secure-pass-123',
            'workspace_name' => '2K Studio',
        ])->assertCreated();

        $response->assertJsonStructure(['token', 'user' => ['id', 'workspaces']]);
        $user = User::sole();
        $this->assertSame('toty@example.com', $user->email);
        $this->assertSame('owner', $user->workspaces()->sole()->pivot->role);
        $this->assertSame('2K Studio', $user->currentWorkspace->name);

        $this->withToken($response->json('token'))->getJson('/api/v1/auth/me')->assertOk()->assertJsonPath('data.email', 'toty@example.com');
    }

    public function test_login_rejects_bad_credentials(): void
    {
        User::factory()->create(['email' => 'a@example.com', 'password' => 'right-password-1']);

        $this->postJson('/api/v1/auth/login', ['email' => 'a@example.com', 'password' => 'wrong'])->assertUnprocessable();
        $this->postJson('/api/v1/auth/login', ['email' => 'a@example.com', 'password' => 'right-password-1'])->assertOk()->assertJsonStructure(['token']);
    }

    public function test_workspace_data_is_isolated(): void
    {
        [$alice, $aliceWorkspace] = $this->workspaceMember();
        [$bob] = $this->workspaceMember();
        $automation = Automation::factory()->create(['workspace_id' => $aliceWorkspace->id]);
        Channel::factory()->create(['workspace_id' => $aliceWorkspace->id]);

        Sanctum::actingAs($bob);
        $this->getJson("/api/v1/automations/{$automation->id}")->assertNotFound();
        $this->getJson('/api/v1/channels')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/automations', ['X-Workspace-Id' => (string) $aliceWorkspace->id])->assertForbidden();

        Sanctum::actingAs($alice);
        $this->getJson("/api/v1/automations/{$automation->id}")->assertOk();
    }

    public function test_viewer_and_agent_roles_cannot_manage_automations_or_channels(): void
    {
        [$viewer] = $this->workspaceMember(WorkspaceRole::Viewer);
        Sanctum::actingAs($viewer);
        $this->postJson('/api/v1/automations', ['template' => 'comment_to_dm'])->assertForbidden();
        $this->getJson('/api/v1/automations')->assertOk();

        [$agent] = $this->workspaceMember(WorkspaceRole::Agent);
        Sanctum::actingAs($agent);
        $this->postJson('/api/v1/channels/connect/instagram')->assertForbidden();
    }

    public function test_connect_without_credentials_explains_required_configuration(): void
    {
        config(['services.instagram.app_id' => null, 'services.instagram.app_secret' => null]);
        [$owner] = $this->workspaceMember();
        Sanctum::actingAs($owner);

        $this->postJson('/api/v1/channels/connect/instagram')
            ->assertUnprocessable()
            ->assertJsonPath('code', 'integration_not_configured')
            ->assertJsonPath('missing', ['INSTAGRAM_APP_ID', 'INSTAGRAM_APP_SECRET']);
    }

    public function test_access_tokens_are_encrypted_at_rest_and_hidden_from_api(): void
    {
        [$owner, $workspace] = $this->workspaceMember();
        $channel = Channel::factory()->create(['workspace_id' => $workspace->id, 'access_token' => 'super-secret-token']);

        $this->assertNotSame('super-secret-token', $channel->getRawOriginal('access_token'));
        $this->assertStringNotContainsString('super-secret-token', \DB::table('channels')->value('access_token'));

        Sanctum::actingAs($owner);
        $this->assertStringNotContainsString('super-secret-token', $this->getJson('/api/v1/channels')->getContent());
    }
}
