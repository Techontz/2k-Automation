<?php

namespace Tests\Feature;

use App\Enums\MessageKind;
use App\Enums\MessageStatus;
use App\Enums\RunStatus;
use App\Models\Automation;
use App\Models\AutomationRun;
use App\Models\Comment;
use App\Models\Message;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The headline scenario: someone comments "LINK" on a Reel and receives a
 * public reply plus the link in a private reply, all via the simulator.
 */
class CommentToDmAutomationTest extends TestCase
{
    use RefreshDatabase;

    public function test_keyword_comment_triggers_public_reply_and_private_dm(): void
    {
        [$user, $workspace] = $this->workspaceMember();
        Sanctum::actingAs($user);
        $automation = Automation::factory()->create(['workspace_id' => $workspace->id]);

        $response = $this->postJson('/api/v1/simulator/comment', ['username' => 'amina.k', 'text' => 'LINK please! 🔥'])->assertCreated();

        $run = AutomationRun::sole();
        $this->assertSame(RunStatus::Completed, $run->status);
        $this->assertTrue($run->is_simulated);
        $this->assertSame($automation->id, $run->automation_id);
        $this->assertSame(['trigger', 'reply_comment', 'send_message', 'add_tag'], $run->steps->pluck('node_type')->all());

        $public = Message::where('kind', MessageKind::CommentReply)->sole();
        $private = Message::where('kind', MessageKind::PrivateReply)->sole();
        $this->assertSame(MessageStatus::Sent, $public->status);
        $this->assertSame(MessageStatus::Sent, $private->status);
        $this->assertTrue($private->is_simulated);
        $this->assertSame('https://example.com/guide', $private->payload['buttons'][0]['url']);

        $comment = Comment::sole();
        $this->assertSame('LINK', $comment->matched_keyword);
        $this->assertNotNull($comment->public_replied_at);
        $this->assertNotNull($comment->private_replied_at);
        $this->assertTrue($run->contact->tags()->where('name', 'reel-lead')->exists());

        $response->assertJsonPath('contact.username', 'amina.k')->assertJsonCount(1, 'runs');
        $this->assertSame(1, $automation->refresh()->completed_count);
    }

    public function test_second_comment_cannot_send_another_dm_without_a_reply(): void
    {
        [$user, $workspace] = $this->workspaceMember();
        Sanctum::actingAs($user);
        Automation::factory()->create(['workspace_id' => $workspace->id]);

        $this->postJson('/api/v1/simulator/comment', ['username' => 'juma', 'text' => 'link'])->assertCreated();
        $this->postJson('/api/v1/simulator/comment', ['username' => 'juma', 'text' => 'LINK again'])->assertCreated();

        $this->assertSame(2, Message::where('kind', MessageKind::PrivateReply)->where('status', MessageStatus::Sent)->count(), 'Each new comment allows its own single private reply.');

        $this->postJson('/api/v1/simulator/message', ['username' => 'juma', 'text' => 'thanks!'])->assertCreated();
        $this->assertSame(1, Message::where('direction', 'in')->count());
    }

    public function test_non_matching_comment_is_stored_without_running_an_automation(): void
    {
        [$user, $workspace] = $this->workspaceMember();
        Sanctum::actingAs($user);
        Automation::factory()->create(['workspace_id' => $workspace->id]);

        $this->postJson('/api/v1/simulator/comment', ['username' => 'fan', 'text' => 'Love this reel, linkedin when?'])->assertCreated();

        $this->assertSame(1, Comment::count());
        $this->assertSame(0, AutomationRun::count());
        $this->assertSame(0, Message::count());
    }

    public function test_paused_automations_do_not_run(): void
    {
        [$user, $workspace] = $this->workspaceMember();
        Sanctum::actingAs($user);
        Automation::factory()->create(['workspace_id' => $workspace->id, 'status' => 'paused']);

        $this->postJson('/api/v1/simulator/comment', ['username' => 'fan', 'text' => 'LINK'])->assertCreated();

        $this->assertSame(0, AutomationRun::count());
    }

    public function test_analytics_endpoints_report_simulated_activity_only_when_requested(): void
    {
        [$user, $workspace] = $this->workspaceMember();
        Sanctum::actingAs($user);
        Automation::factory()->create(['workspace_id' => $workspace->id]);
        $this->postJson('/api/v1/simulator/comment', ['username' => 'amina', 'text' => 'LINK'])->assertCreated();

        $this->getJson('/api/v1/analytics/overview')->assertOk()->assertJsonPath('current.messages_sent', 0);
        $this->getJson('/api/v1/analytics/overview?include_simulated=1')->assertOk()
            ->assertJsonPath('current.messages_sent', 2)
            ->assertJsonPath('current.private_replies', 1);
        $this->getJson('/api/v1/analytics/automations?include_simulated=1')->assertOk()
            ->assertJsonPath('data.0.runs', 1)
            ->assertJsonPath('data.0.completed', 1);
        $this->getJson('/api/v1/analytics/timeseries?days=7&include_simulated=1')->assertOk()->assertJsonCount(8, 'data');
    }
}
