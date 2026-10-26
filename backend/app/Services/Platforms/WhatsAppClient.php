<?php

namespace App\Services\Platforms;

use App\Models\Channel;

/**
 * WhatsApp Business Platform Cloud API. Channel external_id is the phone number ID.
 * Free-form messages only inside the 24h customer service window; templates otherwise.
 */
class WhatsAppClient implements PlatformClient
{
    public function __construct(private readonly MetaGraphApi $api) {}

    public function replyToComment(Channel $channel, string $commentId, string $text): SendResult
    {
        throw PlatformException::unsupported('WhatsApp has no public comments.');
    }

    public function sendPrivateReply(Channel $channel, string $commentId, OutboundMessage $message): SendResult
    {
        throw PlatformException::unsupported('WhatsApp has no comment private replies.');
    }

    public function sendMessage(Channel $channel, string $recipientId, OutboundMessage $message, ?string $tag = null): SendResult
    {
        $body = $message->buttons === []
            ? ['type' => 'text', 'text' => ['body' => mb_substr($message->text, 0, 4096), 'preview_url' => true]]
            : ['type' => 'interactive', 'interactive' => [
                'type' => 'cta_url',
                'body' => ['text' => mb_substr($message->text, 0, 1024)],
                'action' => ['name' => 'cta_url', 'parameters' => [
                    'display_text' => mb_substr($message->buttons[0]['title'], 0, 20),
                    'url' => $message->buttons[0]['url'],
                ]],
            ]];

        return $this->postMessage($channel, $recipientId, $body);
    }

    public function sendTemplate(Channel $channel, string $recipientId, string $template, string $language, array $parameters = []): SendResult
    {
        $components = $parameters === [] ? [] : [[
            'type' => 'body',
            'parameters' => array_map(fn (string $value): array => ['type' => 'text', 'text' => $value], $parameters),
        ]];

        return $this->postMessage($channel, $recipientId, [
            'type' => 'template',
            'template' => ['name' => $template, 'language' => ['code' => $language], 'components' => $components],
        ]);
    }

    public function fetchPosts(Channel $channel, int $limit = 25): array
    {
        return [];
    }

    public function subscribeWebhooks(Channel $channel): void
    {
        $wabaId = $channel->metaValue('waba_id');

        if ($wabaId) {
            $this->api->post("{$wabaId}/subscribed_apps", $channel->access_token);
        }
    }

    /**
     * @param  array<string, mixed>  $body
     */
    private function postMessage(Channel $channel, string $recipientId, array $body): SendResult
    {
        $response = $this->api->post("{$channel->external_id}/messages", $channel->access_token, [
            'messaging_product' => 'whatsapp',
            'recipient_type' => 'individual',
            'to' => $recipientId,
            ...$body,
        ]);

        return new SendResult($response['messages'][0]['id'] ?? null, $response);
    }
}
