<?php

namespace Tests\Feature;

use App\Enums\ConsentType;
use App\Models\AiSetting;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\EmailTemplate;
use App\Models\KnowledgeItem;
use App\Models\Message;
use App\Services\Ai\AiResponder;
use App\Services\Contacts\ConsentService;
use App\Services\Email\EmailService;
use App\Services\Simulator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AiAndEmailTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.anthropic.key' => null, 'services.openai.key' => null]);
    }

    public function test_built_in_responder_answers_from_knowledge_base_in_swahili_and_english(): void
    {
        [, $workspace] = $this->workspaceMember();
        KnowledgeItem::create(['workspace_id' => $workspace->id, 'title' => 'Delivery Dar es Salaam', 'content' => 'We deliver across Dar es Salaam within 24 hours for TZS 5,000.']);
        AiSetting::forWorkspaceOrDefault($workspace)->update(['confidence_threshold' => 0.5]);

        $reply = app(AiResponder::class)->respond($workspace, null, 'Do you deliver in Dar es Salaam?');
        $this->assertFalse($reply->shouldHandover);
        $this->assertStringContainsString('24 hours', $reply->text);
        $this->assertSame('built-in', $reply->provider);

        $unknown = app(AiResponder::class)->respond($workspace, null, 'Habari, bei ya viatu ni gani?');
        $this->assertTrue($unknown->shouldHandover);
        $this->assertSame('sw', $unknown->language);
    }

    public function test_handover_keyword_routes_to_human(): void
    {
        [, $workspace] = $this->workspaceMember();

        $reply = app(AiResponder::class)->respond($workspace, null, 'I want to talk to a human please');

        $this->assertTrue($reply->shouldHandover);
        $this->assertStringContainsString('human', $reply->handoverReason);
    }

    public function test_ai_auto_reply_answers_unmatched_dms_and_flags_unknowns_for_humans(): void
    {
        [, $workspace] = $this->workspaceMember();
        AiSetting::forWorkspaceOrDefault($workspace)->update(['enabled' => true, 'auto_reply_dms' => true, 'confidence_threshold' => 0.5]);
        KnowledgeItem::create(['workspace_id' => $workspace->id, 'title' => 'Opening hours', 'content' => 'Our opening hours are Monday to Saturday, 9am to 6pm.']);
        $simulator = app(Simulator::class);

        $simulator->message($workspace, 'client1', 'What are your opening hours?');
        $this->assertSame('ai', Message::where('direction', 'out')->sole()->source);

        $simulator->message($workspace, 'client2', 'My parcel arrived broken');
        $this->assertTrue(Contact::where('username', 'client2')->sole()->hasMany(Conversation::class)->sole()->needs_human);
    }

    public function test_email_requires_matching_consent_and_includes_unsubscribe_link(): void
    {
        [, $workspace] = $this->workspaceMember();
        $contact = Contact::factory()->create(['email' => 'lead@example.com']);
        $contact->update(['workspace_id' => $workspace->id]);
        $marketing = EmailTemplate::create(['workspace_id' => $workspace->id, 'name' => 'Promo', 'subject' => 'Sale', 'body_html' => '<p>Hi {{first_name}}</p>', 'category' => 'marketing']);
        $email = app(EmailService::class);

        $this->assertSame('skipped', $email->sendToContact($contact, $marketing, ['simulated' => true])->status);

        app(ConsentService::class)->grant($contact, ConsentType::EmailTransactional, 'test');
        $this->assertSame('skipped', $email->sendToContact($contact, $marketing, ['simulated' => true])->status, 'Transactional consent is not marketing consent.');

        app(ConsentService::class)->grant($contact, ConsentType::EmailMarketing, 'test');
        $this->assertSame('sent', $email->sendToContact($contact, $marketing, ['simulated' => true])->status);

        app(ConsentService::class)->revoke($contact, ConsentType::EmailMarketing, 'test');
        $this->assertSame('skipped', $email->sendToContact($contact, $marketing, ['simulated' => true])->status);
    }

    public function test_unsubscribe_link_revokes_consent(): void
    {
        $contact = Contact::factory()->create(['email' => 'x@example.com']);
        app(ConsentService::class)->grant($contact, ConsentType::EmailMarketing, 'test');

        $this->get(\URL::signedRoute('v1.email.unsubscribe', ['contact' => $contact->id]))->assertOk()->assertSee('unsubscribed');
        $this->get(route('v1.email.unsubscribe', ['contact' => $contact->id]))->assertForbidden();

        $this->assertFalse($contact->hasConsent(ConsentType::EmailMarketing));
    }
}
