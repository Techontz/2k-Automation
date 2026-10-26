<?php

namespace App\Services\Platforms;

use App\Models\Channel;

/**
 * Facebook Page comments + Messenger Platform Send API using a Page access token.
 */
class FacebookClient implements PlatformClient
{
    public function __construct(private readonly MetaGraphApi $api) {}

    public function replyToComment(Channel $channel, string $commentId, string $text): SendResult
    {
        $response = $this->api->post("{$commentId}/comments", $channel->access_token, ['message' => $text]);

        return new SendResult($response['id'] ?? null, $response);
    }

    public function sendPrivateReply(Channel $channel, string $commentId, OutboundMessage $message): SendResult
    {
        return $this->postMessage($channel, ['comment_id' => $commentId], $message, 'RESPONSE');
    }

    public function sendMessage(Channel $channel, string $recipientId, OutboundMessage $message, ?string $tag = null): SendResult
    {
        return $this->postMessage($channel, ['id' => $recipientId], $message, $tag ? 'MESSAGE_TAG' : 'RESPONSE', $tag);
    }

    public function sendTemplate(Channel $channel, string $recipientId, string $template, string $language, array $parameters = []): SendResult
    {
        throw PlatformException::unsupported('Messenger does not use pre-approved templates; use a message tag inside its permitted window.');
    }

    public function fetchPosts(Channel $channel, int $limit = 25): array
    {
        $response = $this->api->get("{$channel->external_id}/posts", $channel->access_token, [
            'fields' => 'id,message,permalink_url,full_picture,created_time',
            'limit' => $limit,
        ]);

        return array_map(fn (array $post): array => [
            'external_id' => $post['id'],
            'media_type' => 'post',
            'caption' => $post['message'] ?? null,
            'permalink' => $post['permalink_url'] ?? null,
            'thumbnail_url' => $post['full_picture'] ?? null,
            'published_at' => $post['created_time'] ?? null,
        ], $response['data'] ?? []);
    }

    public function subscribeWebhooks(Channel $channel): void
    {
        $this->api->post("{$channel->external_id}/subscribed_apps", $channel->access_token, [
            'subscribed_fields' => 'feed,messages,messaging_postbacks,message_deliveries,message_reads',
        ]);
    }

    /**
     * @param  array<string, string>  $recipient
     */
    private function postMessage(Channel $channel, array $recipient, OutboundMessage $message, string $messagingType, ?string $tag = null): SendResult
    {
        $body = [
            'recipient' => $recipient,
            'messaging_type' => $messagingType,
            'message' => $message->buttons === [] || count($message->buttons) > 3
                ? ['text' => mb_substr($message->textWithLinks(), 0, 2000)]
                : ['attachment' => ['type' => 'template', 'payload' => [
                    'template_type' => 'button',
                    'text' => mb_substr($message->text, 0, 640),
                    'buttons' => array_map(fn (array $button): array => ['type' => 'web_url', 'url' => $button['url'], 'title' => mb_substr($button['title'], 0, 20)], $message->buttons),
                ]]],
        ];

        if ($tag !== null) {
            $body['tag'] = $tag;
        }

        $response = $this->api->post("{$channel->external_id}/messages", $channel->access_token, $body);

        return new SendResult($response['message_id'] ?? null, $response);
    }
}
