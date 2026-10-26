<?php

namespace App\Services;

use App\Enums\Platform;
use App\Models\Channel;
use App\Models\Post;
use App\Models\Workspace;
use App\Services\Webhooks\MetaPayloadNormalizer;
use App\Services\Webhooks\WebhookRecorder;
use Illuminate\Support\Str;

/**
 * Builds genuine Meta-shaped webhook payloads for a simulated Instagram
 * account and feeds them through the real ingestion pipeline. All records are
 * flagged is_simulated and outbound sends never leave the server.
 */
class Simulator
{
    public function __construct(
        private readonly MetaPayloadNormalizer $normalizer,
        private readonly WebhookRecorder $recorder,
    ) {}

    public function channel(Workspace $workspace): Channel
    {
        $channel = Channel::firstOrCreate(
            ['workspace_id' => $workspace->id, 'platform' => Platform::Instagram->value, 'external_id' => 'sim_ig_'.$workspace->id],
            ['is_simulated' => true, 'name' => 'Simulated Instagram', 'username' => 'yourbrand.sim', 'status' => 'connected', 'meta' => ['note' => 'Test account — nothing is sent to Instagram.']],
        );

        if ($channel->posts()->doesntExist()) {
            foreach ([
                ['reel', 'Free Claude prompt guide — comment CLAUDE and I will DM it to you 👇'],
                ['reel', 'My 5-step content system. Comment LINK for the template.'],
                ['post', 'New product launch this Friday! Comment PRICE for details.'],
            ] as $index => [$type, $caption]) {
                Post::create([
                    'workspace_id' => $workspace->id,
                    'channel_id' => $channel->id,
                    'external_id' => 'sim_media_'.$workspace->id.'_'.($index + 1),
                    'media_type' => $type,
                    'caption' => $caption,
                    'published_at' => now()->subDays($index + 1),
                ]);
            }
        }

        return $channel;
    }

    /**
     * @return array{comment_id: string, sender_id: string}
     */
    public function comment(Workspace $workspace, ?int $postId, string $username, string $text): array
    {
        $channel = $this->channel($workspace);
        $post = $postId ? $channel->posts()->findOrFail($postId) : $channel->posts()->orderBy('id')->first();
        $senderId = $this->senderId($workspace, $username);
        $commentId = 'sim_comment_'.Str::lower(Str::random(12));

        $this->push([
            'object' => 'instagram',
            'entry' => [[
                'id' => $channel->external_id,
                'time' => now()->timestamp,
                'changes' => [[
                    'field' => 'comments',
                    'value' => [
                        'from' => ['id' => $senderId, 'username' => ltrim($username, '@')],
                        'media' => ['id' => $post->external_id, 'media_product_type' => $post->media_type === 'reel' ? 'REELS' : 'FEED'],
                        'id' => $commentId,
                        'text' => $text,
                    ],
                ]],
            ]],
        ]);

        return ['comment_id' => $commentId, 'sender_id' => $senderId];
    }

    /**
     * @return array{message_id: string, sender_id: string}
     */
    public function message(Workspace $workspace, string $username, string $text, bool $storyReply = false): array
    {
        $channel = $this->channel($workspace);
        $senderId = $this->senderId($workspace, $username);
        $messageId = 'sim_mid_'.Str::lower(Str::random(16));
        $message = ['mid' => $messageId, 'text' => $text];

        if ($storyReply) {
            $message['reply_to'] = ['story' => ['id' => 'sim_story_1', 'url' => 'https://example.com/story']];
        }

        $this->push([
            'object' => 'instagram',
            'entry' => [[
                'id' => $channel->external_id,
                'time' => now()->timestamp,
                'messaging' => [[
                    'sender' => ['id' => $senderId],
                    'recipient' => ['id' => $channel->external_id],
                    'timestamp' => now()->getTimestampMs(),
                    'message' => $message,
                ]],
            ]],
        ]);

        // Usernames arrive via the profile API on real accounts; set it directly for simulated ones.
        $channel->workspace->contacts()->where('channel_id', $channel->id)->where('external_id', $senderId)->whereNull('username')->update(['username' => ltrim($username, '@')]);

        return ['message_id' => $messageId, 'sender_id' => $senderId];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function push(array $payload): void
    {
        $this->recorder->record($this->normalizer->normalize($payload), simulated: true);
    }

    private function senderId(Workspace $workspace, string $username): string
    {
        return 'sim_user_'.substr(sha1($workspace->id.'|'.mb_strtolower(ltrim($username, '@'))), 0, 16);
    }
}
