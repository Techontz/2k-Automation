<?php

namespace App\Services\Webhooks;

use Illuminate\Support\Carbon;

/**
 * TikTok business webhooks. Only comment events are mapped; the exact payload
 * shape should be re-checked against the TikTok developer portal on approval.
 */
class TikTokPayloadNormalizer
{
    /**
     * @param  array<string, mixed>  $payload
     * @return list<InboundEvent>
     */
    public function normalize(array $payload): array
    {
        $event = $payload['event'] ?? '';

        if (! str_contains((string) $event, 'comment')) {
            return [];
        }

        $content = is_string($payload['content'] ?? null) ? json_decode($payload['content'], true) : ($payload['content'] ?? []);

        if (! isset($content['comment_id'])) {
            return [];
        }

        return [new InboundEvent(
            platform: 'tiktok',
            type: InboundEvent::Comment,
            accountId: (string) ($payload['user_openid'] ?? $content['business_id'] ?? ''),
            externalId: (string) $content['comment_id'],
            senderId: isset($content['user_id']) ? (string) $content['user_id'] : null,
            senderUsername: $content['username'] ?? null,
            text: $content['text'] ?? '',
            mediaId: isset($content['video_id']) ? (string) $content['video_id'] : null,
            mediaType: 'video',
            parentId: $content['parent_comment_id'] ?? null,
            occurredAt: isset($payload['create_time']) ? Carbon::createFromTimestamp($payload['create_time']) : now(),
        )];
    }
}
