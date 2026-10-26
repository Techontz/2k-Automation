<?php

namespace Tests\Feature;

use App\Models\Channel;
use App\Models\Contact;
use App\Services\Messaging\MessageDispatcher;
use App\Services\Platforms\InstagramClient;
use App\Services\Platforms\MetaGraphApi;
use App\Services\Platforms\OutboundMessage;
use App\Services\Platforms\PlatformException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class InstagramClientTest extends TestCase
{
    use RefreshDatabase;

    public function test_private_reply_uses_comment_id_and_button_template(): void
    {
        Http::fake(['*' => Http::response(['message_id' => 'mid_42'])]);
        $channel = Channel::factory()->create(['external_id' => 'ig_1']);
        $client = new InstagramClient(MetaGraphApi::instagram());

        $result = $client->sendPrivateReply($channel, 'comment_9', new OutboundMessage('Here you go', [['title' => 'Get the guide', 'url' => 'https://example.com']]));

        $this->assertSame('mid_42', $result->externalId);
        Http::assertSent(function ($request) use ($channel): bool {
            return $request->url() === 'https://graph.instagram.com/'.config('services.meta.graph_version').'/ig_1/messages'
                && $request->hasHeader('Authorization', 'Bearer '.$channel->access_token)
                && $request['recipient'] === ['comment_id' => 'comment_9']
                && $request['message']['attachment']['payload']['template_type'] === 'button';
        });
    }

    public function test_graph_error_codes_map_to_retry_categories(): void
    {
        $channel = Channel::factory()->create();
        $client = new InstagramClient(MetaGraphApi::instagram());

        $cases = [[4, PlatformException::RateLimited], [190, PlatformException::Auth], [10, PlatformException::Policy], [100, PlatformException::Invalid]];
        $sequence = Http::sequence();

        foreach ($cases as [$code]) {
            $sequence->push(['error' => ['code' => $code, 'message' => 'error']], 400);
        }

        Http::fake(['*' => $sequence]);

        foreach ($cases as [$code, $category]) {
            try {
                $client->replyToComment($channel, 'c1', 'hi');
                $this->fail('Expected exception');
            } catch (PlatformException $exception) {
                $this->assertSame($category, $exception->category, "Code {$code}");
            }
        }
    }

    public function test_auth_failure_marks_channel_expired(): void
    {
        Http::fake(['*' => Http::response(['error' => ['code' => 190, 'message' => 'Token expired']], 401)]);
        $channel = Channel::factory()->create();
        $contact = Contact::factory()->messagedHoursAgo(1)->create(['channel_id' => $channel->id]);

        $message = app(MessageDispatcher::class)->sendDirect($channel, $contact, new OutboundMessage('hi'));

        $this->assertSame('failed', $message->status->value);
        $this->assertSame('expired', $channel->refresh()->status);
    }
}
