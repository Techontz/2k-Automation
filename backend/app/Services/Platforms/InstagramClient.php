<?php

namespace App\Services\Platforms;

use App\Models\Channel;

/**
 * Instagram API with Instagram Login (graph.instagram.com).
 * Requires instagram_business_basic, instagram_business_manage_messages and
 * instagram_business_manage_comments, approved through Meta App Review.
 */
class InstagramClient implements PlatformClient
{
    public function __construct(private readonly MetaGraphApi $api) {}

    public function replyToComment(Channel $channel, string $commentId, string $text): SendResult
    {
        $response = $this->api->post("{$commentId}/replies", $channel->access_token, ['message' => $text]);

        return new SendResult($response['id'] ?? null, $response);
    }

    public function sendPrivateReply(Channel $channel, string $commentId, OutboundMessage $message): SendResult
    {
        return $this->postMessage($channel, ['comment_id' => $commentId], $message);
    }

    public function sendMessage(Channel $channel, string $recipientId, OutboundMessage $message, ?string $tag = null): SendResult
    {
        return $this->postMessage($channel, ['id' => $recipientId], $message, $tag);
    }

    public function sendTemplate(Channel $channel, string $recipientId, string $template, string $language, array $parameters = []): SendResult
    {
        throw PlatformException::unsupported('Instagram does not support pre-approved message templates.');
    }

    public function fetchPosts(Channel $channel, int $limit = 25): array
    {
        $response = $this->api->get("{$channel->external_id}/media", $channel->access_token, [
            'fields' => 'id,caption,media_type,media_product_type,permalink,thumbnail_url,media_url,timestamp',
            'limit' => $limit,
        ]);

        return array_map(fn (array $media): array => [
            'external_id' => $media['id'],
            'media_type' => ($media['media_product_type'] ?? '') === 'REELS' ? 'reel' : strtolower($media['media_type'] ?? 'post'),
            'caption' => $media['caption'] ?? null,
            'permalink' => $media['permalink'] ?? null,
            'thumbnail_url' => $media['thumbnail_url'] ?? $media['media_url'] ?? null,
            'published_at' => $media['timestamp'] ?? null,
        ], $response['data'] ?? []);
    }

    public function subscribeWebhooks(Channel $channel): void
    {
        $this->api->post('me/subscribed_apps', $channel->access_token, [
            'subscribed_fields' => 'comments,messages,messaging_postbacks,messaging_seen,message_reactions',
        ]);
    }

    /**
     * @param  array<string, string>  $recipient
     */
    private function postMessage(Channel $channel, array $recipient, OutboundMessage $message, ?string $tag = null): SendResult
    {
        $body = ['recipient' => $recipient, 'message' => $this->buildPayload($message)];

        if ($tag !== null) {
            $body['messaging_type'] = 'MESSAGE_TAG';
            $body['tag'] = $tag;
        }

        $response = $this->api->post("{$channel->external_id}/messages", $channel->access_token, $body);

        return new SendResult($response['message_id'] ?? null, $response);
    }

    /**
     * Up to three URL buttons render as a button template; otherwise plain text.
     *
     * @return array<string, mixed>
     */
    private function buildPayload(OutboundMessage $message): array
    {
        if ($message->buttons === [] || count($message->buttons) > 3 || mb_strlen($message->text) > 640) {
            return ['text' => mb_strcut($message->textWithLinks(), 0, 1000)];
        }

        return [
            'attachment' => [
                'type' => 'template',
                'payload' => [
                    'template_type' => 'button',
                    'text' => $message->text,
                    'buttons' => array_map(fn (array $button): array => [
                        'type' => 'web_url',
                        'url' => $button['url'],
                        'title' => mb_substr($button['title'], 0, 20),
                    ], $message->buttons),
                ],
            ],
        ];
    }
}
