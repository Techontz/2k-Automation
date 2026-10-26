<?php

namespace Tests\Feature;

use App\Models\Channel;
use App\Models\Comment;
use App\Models\Contact;
use App\Services\Messaging\MessagingPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MessagingPolicyTest extends TestCase
{
    use RefreshDatabase;

    private MessagingPolicy $policy;

    protected function setUp(): void
    {
        parent::setUp();
        $this->policy = new MessagingPolicy;
    }

    public function test_dm_allowed_within_24_hours_of_last_inbound_message(): void
    {
        $contact = Contact::factory()->messagedHoursAgo(3)->create();

        $decision = $this->policy->forDirectMessage($contact->channel, $contact);

        $this->assertTrue($decision->allowed);
        $this->assertSame('response', $decision->mode);
    }

    public function test_dm_blocked_when_contact_never_messaged(): void
    {
        $contact = Contact::factory()->create();

        $decision = $this->policy->forDirectMessage($contact->channel, $contact);

        $this->assertFalse($decision->allowed);
        $this->assertStringContainsString('has not messaged you yet', $decision->reason);
    }

    public function test_automation_dm_blocked_outside_window_but_human_agent_allowed_within_seven_days(): void
    {
        $contact = Contact::factory()->messagedHoursAgo(30)->create();

        $this->assertFalse($this->policy->forDirectMessage($contact->channel, $contact)->allowed);

        $human = $this->policy->forDirectMessage($contact->channel, $contact, null, sentByHuman: true);
        $this->assertTrue($human->allowed);
        $this->assertSame('HUMAN_AGENT', $human->tag);
    }

    public function test_private_reply_allowed_once_within_seven_days_of_comment(): void
    {
        $contact = Contact::factory()->create();
        $comment = $this->comment($contact, now()->subDays(2));

        $this->assertSame('private_reply', $this->policy->forDirectMessage($contact->channel, $contact, $comment)->mode);

        $comment->private_replied_at = now();
        $this->assertFalse($this->policy->forDirectMessage($contact->channel, $contact, $comment)->allowed);
    }

    public function test_private_reply_blocked_after_seven_days(): void
    {
        $contact = Contact::factory()->create();
        $comment = $this->comment($contact, now()->subDays(8));

        $decision = $this->policy->forDirectMessage($contact->channel, $contact, $comment);

        $this->assertFalse($decision->allowed);
        $this->assertStringContainsString('7-day', $decision->reason);
    }

    public function test_whatsapp_outside_window_requires_template(): void
    {
        $channel = Channel::factory()->platform('whatsapp')->create();
        $contact = Contact::factory()->messagedHoursAgo(30)->create(['channel_id' => $channel->id]);

        $decision = $this->policy->forDirectMessage($channel, $contact);
        $this->assertFalse($decision->allowed);
        $this->assertStringContainsString('template', $decision->reason);
        $this->assertTrue($this->policy->forTemplate($channel, $contact)->allowed);
    }

    public function test_tiktok_direct_messages_are_never_allowed(): void
    {
        $channel = Channel::factory()->platform('tiktok')->create();
        $contact = Contact::factory()->messagedHoursAgo(1)->create(['channel_id' => $channel->id]);

        $this->assertFalse($this->policy->forDirectMessage($channel, $contact)->allowed);
    }

    public function test_disconnected_channels_and_unsubscribed_contacts_are_blocked(): void
    {
        $contact = Contact::factory()->messagedHoursAgo(1)->create(['unsubscribed' => true]);
        $this->assertFalse($this->policy->forDirectMessage($contact->channel, $contact)->allowed);

        $contact->unsubscribed = false;
        $contact->channel->status = 'expired';
        $this->assertStringContainsString('expired', $this->policy->forDirectMessage($contact->channel, $contact)->reason);
    }

    private function comment(Contact $contact, \DateTimeInterface $at): Comment
    {
        return Comment::create([
            'workspace_id' => $contact->workspace_id,
            'channel_id' => $contact->channel_id,
            'contact_id' => $contact->id,
            'external_id' => 'c_'.uniqid(),
            'text' => 'LINK',
            'commented_at' => $at,
        ]);
    }

    public function test_private_replies_are_throttled_below_the_hourly_platform_cap(): void
    {
        config(['automation.limits.private_replies_per_hour' => 2]);
        $channel = Channel::factory()->simulated()->create();
        $dispatcher = app(\App\Services\Messaging\MessageDispatcher::class);

        foreach ([1, 2] as $attempt) {
            $contact = Contact::factory()->create(['channel_id' => $channel->id]);
            $this->assertSame('sent', $dispatcher->sendDirect($channel, $contact, new \App\Services\Platforms\OutboundMessage('hi'), $this->comment($contact, now()))->status->value);
        }

        $contact = Contact::factory()->create(['channel_id' => $channel->id]);
        $this->expectException(\App\Services\Platforms\PlatformException::class);
        $dispatcher->sendDirect($channel, $contact, new \App\Services\Platforms\OutboundMessage('hi'), $this->comment($contact, now()));
    }
}
