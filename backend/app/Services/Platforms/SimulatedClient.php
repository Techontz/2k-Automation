<?php

namespace App\Services\Platforms;

use App\Models\Channel;
use Illuminate\Support\Str;

/**
 * Stand-in for real platform APIs in simulation mode. Nothing leaves the server.
 * Include "[fail]" in a message to exercise the failure path.
 */
class SimulatedClient implements PlatformClient
{
    public function replyToComment(Channel $channel, string $commentId, string $text): SendResult
    {
        return $this->accept($text, ['comment_id' => $commentId]);
    }

    public function sendPrivateReply(Channel $channel, string $commentId, OutboundMessage $message): SendResult
    {
        return $this->accept($message->text, ['comment_id' => $commentId]);
    }

    public function sendMessage(Channel $channel, string $recipientId, OutboundMessage $message, ?string $tag = null): SendResult
    {
        return $this->accept($message->text, ['recipient' => $recipientId, 'tag' => $tag]);
    }

    public function sendTemplate(Channel $channel, string $recipientId, string $template, string $language, array $parameters = []): SendResult
    {
        return $this->accept($template, ['template' => $template]);
    }

    public function fetchPosts(Channel $channel, int $limit = 25): array
    {
        return [];
    }

    public function subscribeWebhooks(Channel $channel): void {}

    /**
     * @param  array<string, mixed>  $raw
     */
    private function accept(string $text, array $raw): SendResult
    {
        if (str_contains($text, '[fail]')) {
            throw new PlatformException('Simulated delivery failure.', PlatformException::Invalid, 'SIMULATED');
        }

        return new SendResult('sim_'.Str::lower(Str::random(16)), ['simulated' => true, ...$raw]);
    }
}
