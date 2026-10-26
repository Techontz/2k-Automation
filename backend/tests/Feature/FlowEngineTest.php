<?php

namespace Tests\Feature;

use App\Enums\ConsentType;
use App\Enums\RunStatus;
use App\Models\Automation;
use App\Models\AutomationRun;
use App\Models\Channel;
use App\Models\Contact;
use App\Models\Message;
use App\Services\Automation\FlowExecutor;
use App\Services\Simulator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FlowEngineTest extends TestCase
{
    use RefreshDatabase;

    public function test_lead_magnet_collects_email_with_retry_and_records_consent(): void
    {
        [, $workspace] = $this->workspaceMember();
        Automation::factory()->fromTemplate('lead_magnet')->create(['workspace_id' => $workspace->id]);
        $simulator = app(Simulator::class);

        $simulator->comment($workspace, null, 'neema', 'GUIDE');
        $run = AutomationRun::sole();
        $this->assertSame(RunStatus::Waiting, $run->status);
        $this->assertSame('email', $run->waiting_for);

        $simulator->message($workspace, 'neema', 'my email is neema at gmail');
        $this->assertSame('email', $run->refresh()->waiting_for, 'Invalid email asks again.');

        $simulator->message($workspace, 'neema', 'Sorry: Neema@Example.com');
        $run->refresh();
        $contact = $run->contact;

        $this->assertSame(RunStatus::Completed, $run->status);
        $this->assertSame('neema@example.com', $contact->email);
        $this->assertTrue($contact->hasConsent(ConsentType::EmailTransactional));
        $this->assertFalse($contact->hasConsent(ConsentType::EmailMarketing));
        $this->assertTrue($contact->tags()->where('name', 'guide-subscriber')->exists());
        $this->assertStringContainsString('neema@example.com', Message::where('direction', 'out')->latest('id')->first()->body);
    }

    public function test_condition_branches_on_contact_email(): void
    {
        [, $workspace] = $this->workspaceMember();
        Automation::factory()->fromTemplate('dm_keyword_price')->create(['workspace_id' => $workspace->id]);
        $simulator = app(Simulator::class);

        $simulator->message($workspace, 'baraka', 'What is the price?');
        $run = AutomationRun::sole();
        $this->assertSame('reply', $run->waiting_for);

        $simulator->message($workspace, 'baraka', 'yes please');
        $steps = $run->refresh()->steps->pluck('node_type')->all();

        $this->assertContains('condition', $steps);
        $this->assertContains('collect_email', $steps, 'No email on file, so the false branch asks for one.');
        $this->assertSame('Condition not met', $run->steps->firstWhere('node_type', 'condition')->summary);
    }

    public function test_delay_pauses_and_scheduler_resumes(): void
    {
        [, $workspace] = $this->workspaceMember();
        $flow = [
            'nodes' => [
                ['id' => 't', 'type' => 'trigger', 'data' => []],
                ['id' => 'd', 'type' => 'delay', 'data' => ['amount' => 10, 'unit' => 'minutes']],
                ['id' => 'tag', 'type' => 'add_tag', 'data' => ['tag' => 'after-delay']],
            ],
            'edges' => [['source' => 't', 'target' => 'd'], ['source' => 'd', 'target' => 'tag']],
        ];
        Automation::factory()->create(['workspace_id' => $workspace->id, 'trigger_type' => 'any_dm', 'trigger_config' => [], 'flow' => $flow]);

        app(Simulator::class)->message($workspace, 'zawadi', 'hello');
        $run = AutomationRun::sole();
        $this->assertSame(RunStatus::Waiting, $run->status);
        $this->assertSame('delay', $run->waiting_for);

        $this->artisan('automations:resume-due')->assertSuccessful();
        $this->assertSame(RunStatus::Waiting, $run->refresh()->status, 'Not due yet.');

        $this->travel(11)->minutes();
        $this->artisan('automations:resume-due')->assertSuccessful();

        $this->assertSame(RunStatus::Completed, $run->refresh()->status);
        $this->assertTrue($run->contact->tags()->where('name', 'after-delay')->exists());
    }

    public function test_rate_limited_send_fails_the_run_after_retries_without_duplicate_messages(): void
    {
        Http::fake(['graph.instagram.com/*' => Http::response(['error' => ['code' => 4, 'message' => 'Application request limit reached']], 400)]);
        $channel = Channel::factory()->create();
        $contact = Contact::factory()->messagedHoursAgo(1)->create(['channel_id' => $channel->id]);
        $automation = Automation::factory()->create([
            'workspace_id' => $channel->workspace_id,
            'trigger_type' => 'any_dm',
            'trigger_config' => [],
            'flow' => [
                'nodes' => [['id' => 't', 'type' => 'trigger', 'data' => []], ['id' => 'm', 'type' => 'send_message', 'data' => ['text' => 'Hi']]],
                'edges' => [['source' => 't', 'target' => 'm']],
            ],
        ]);

        $run = app(FlowExecutor::class)->start($automation, $contact, ['type' => 'dm', 'text' => 'hey']);

        $this->assertSame(RunStatus::Failed, $run->refresh()->status);
        $this->assertSame('m', $run->current_node_id, 'Run keeps its position so it can be retried.');
        $this->assertSame('failed', Message::sole()->status->value);
        $this->assertSame('4', Message::sole()->error_code);
    }

    public function test_flow_validation_blocks_activation_of_incomplete_flows(): void
    {
        [$user, $workspace] = $this->workspaceMember();
        $automation = Automation::factory()->fromTemplate('blank')->create(['workspace_id' => $workspace->id, 'status' => 'draft']);

        $this->actingAs($user)->postJson("/api/v1/automations/{$automation->id}/activate")
            ->assertUnprocessable()
            ->assertJsonValidationErrors('flow');
    }

    public function test_saving_a_flow_through_the_api_preserves_node_data_and_trigger_settings(): void
    {
        [$user, $workspace] = $this->workspaceMember();
        $automation = Automation::factory()->create(['workspace_id' => $workspace->id]);
        $flow = $automation->flow;
        $flow['nodes'][2]['data']['text'] = 'Updated DM {{first_name}}';
        $flow['nodes'][2]['position'] = ['x' => 321, 'y' => 654];

        $this->actingAs($user)->patchJson("/api/v1/automations/{$automation->id}", [
            'flow' => $flow,
            'trigger_config' => ['keywords' => ['LINK'], 'match' => 'contains', 'exclude_keywords' => ['spam'], 'once_per_contact' => true, 'skip_replies' => true, 'post_ids' => []],
        ])->assertOk()->assertJsonPath('data.trigger_config.once_per_contact', true);

        $automation->refresh();
        $this->assertSame('Updated DM {{first_name}}', $automation->flow['nodes'][2]['data']['text']);
        $this->assertSame(321, $automation->flow['nodes'][2]['position']['x']);
        $this->assertSame(['spam'], $automation->trigger_config['exclude_keywords']);
    }
}
