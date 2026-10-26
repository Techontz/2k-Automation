<?php

namespace Tests\Feature;

use App\Models\Automation;
use App\Models\Channel;
use App\Models\Comment;
use App\Models\Message;
use App\Models\WebhookEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WebhookIngestionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config(['services.meta.app_secret' => 'test-secret', 'services.meta.webhook_verify_token' => 'verify-me']);
    }

    public function test_meta_verification_handshake(): void
    {
        $this->get('/api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=12345')
            ->assertOk()->assertSee('12345');

        $this->get('/api/v1/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345')
            ->assertForbidden();
    }

    public function test_invalid_signature_is_rejected(): void
    {
        $this->postJson('/api/v1/webhooks/meta', ['object' => 'instagram', 'entry' => []], ['X-Hub-Signature-256' => 'sha256=deadbeef'])
            ->assertUnauthorized();

        $this->assertSame(0, WebhookEvent::count());
    }

    public function test_signed_instagram_comment_is_ingested_once_and_replies_via_graph_api(): void
    {
        Http::fake([
            'graph.instagram.com/*/replies' => Http::response(['id' => 'reply_1']),
            'graph.instagram.com/*/messages' => Http::response(['recipient_id' => '999', 'message_id' => 'mid_1']),
        ]);

        $channel = Channel::factory()->create(['external_id' => '17841400000000001']);
        Automation::factory()->create(['workspace_id' => $channel->workspace_id]);
        $payload = $this->commentPayload('17841400000000001', 'comment_1', 'LINK');

        $this->postJson('/api/v1/webhooks/meta', $payload, $this->metaSignatureHeaders($payload))->assertOk();
        $this->postJson('/api/v1/webhooks/meta', $payload, $this->metaSignatureHeaders($payload))->assertOk();

        $this->assertSame(1, WebhookEvent::count(), 'Retried deliveries are deduplicated.');
        $this->assertSame('processed', WebhookEvent::sole()->status);
        $this->assertSame(1, Comment::count());

        Http::assertSent(fn ($request) => str_ends_with($request->url(), 'comment_1/replies'));
        Http::assertSent(fn ($request) => str_ends_with($request->url(), '17841400000000001/messages')
            && $request['recipient'] === ['comment_id' => 'comment_1']);
        $this->assertSame(2, Message::where('status', 'sent')->count());
    }

    public function test_comments_from_the_account_itself_are_ignored(): void
    {
        $channel = Channel::factory()->create(['external_id' => '17841400000000002']);
        Automation::factory()->create(['workspace_id' => $channel->workspace_id]);
        $payload = $this->commentPayload('17841400000000002', 'comment_2', 'LINK', fromId: '17841400000000002');

        $this->postJson('/api/v1/webhooks/meta', $payload, $this->metaSignatureHeaders($payload))->assertOk();

        $this->assertSame('ignored', WebhookEvent::sole()->status);
        $this->assertSame(0, Comment::count());
    }

    public function test_inbound_dm_opens_the_messaging_window(): void
    {
        $channel = Channel::factory()->create(['external_id' => '17841400000000003']);
        $payload = ['object' => 'instagram', 'entry' => [[
            'id' => '17841400000000003',
            'time' => now()->timestamp,
            'messaging' => [[
                'sender' => ['id' => 'igsid_1'],
                'recipient' => ['id' => '17841400000000003'],
                'timestamp' => now()->getTimestampMs(),
                'message' => ['mid' => 'mid_in_1', 'text' => 'Hi there'],
            ]],
        ]]];

        $this->postJson('/api/v1/webhooks/meta', $payload, $this->metaSignatureHeaders($payload))->assertOk();

        $message = Message::sole();
        $this->assertSame('in', $message->direction);
        $this->assertNotNull($message->conversation_id);
        $this->assertTrue($channel->workspace->contacts()->sole()->last_inbound_at->isToday());
    }

    /**
     * @return array<string, mixed>
     */
    private function commentPayload(string $accountId, string $commentId, string $text, string $fromId = '555'): array
    {
        return ['object' => 'instagram', 'entry' => [[
            'id' => $accountId,
            'time' => now()->timestamp,
            'changes' => [[
                'field' => 'comments',
                'value' => [
                    'from' => ['id' => $fromId, 'username' => 'follower'],
                    'media' => ['id' => 'media_1', 'media_product_type' => 'REELS'],
                    'id' => $commentId,
                    'text' => $text,
                ],
            ]],
        ]]];
    }
}
