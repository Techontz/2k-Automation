<?php

namespace App\Services\Platforms;

use App\Models\Channel;

interface PlatformClient
{
    /**
     * Publish a public reply under a comment.
     */
    public function replyToComment(Channel $channel, string $commentId, string $text): SendResult;

    /**
     * Send the single permitted private reply to the author of a comment.
     */
    public function sendPrivateReply(Channel $channel, string $commentId, OutboundMessage $message): SendResult;

    /**
     * Send a direct message inside an open messaging window.
     *
     * @param  string|null  $tag  Platform message tag (e.g. HUMAN_AGENT) when outside the standard window.
     */
    public function sendMessage(Channel $channel, string $recipientId, OutboundMessage $message, ?string $tag = null): SendResult;

    /**
     * Send a pre-approved template (WhatsApp outside the 24h window).
     *
     * @param  list<string>  $parameters
     */
    public function sendTemplate(Channel $channel, string $recipientId, string $template, string $language, array $parameters = []): SendResult;

    /**
     * Recent posts / videos for keyword targeting.
     *
     * @return list<array{external_id: string, media_type: string, caption: string|null, permalink: string|null, thumbnail_url: string|null, published_at: string|null}>
     */
    public function fetchPosts(Channel $channel, int $limit = 25): array;

    /**
     * Subscribe the connected account to the app's webhook fields.
     */
    public function subscribeWebhooks(Channel $channel): void;
}
