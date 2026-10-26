<?php

namespace App\Services\Ai\Drivers;

use Anthropic\Client;

/**
 * Claude via the official Anthropic PHP SDK. Uses structured outputs for a
 * guaranteed JSON shape, low effort (short conversational replies) and the
 * server-side default fallback so a policy decline is retried automatically.
 */
class AnthropicDriver implements AiDriver
{
    public function generate(string $system, array $messages, string $model, string $apiKey): array
    {
        $client = new Client(apiKey: $apiKey);

        $response = $client->beta->messages->create(
            model: $model,
            maxTokens: 2048,
            system: $system,
            messages: $messages,
            outputConfig: [
                'effort' => 'low',
                'format' => ['type' => 'json_schema', 'schema' => ReplySchema::schema()],
            ],
            fallbacks: 'default',
            betas: ['server-side-fallback-2026-07-01'],
        );

        if ($response->stopReason === 'refusal') {
            return ['reply' => '', 'confidence' => 0.0, 'language' => 'en', 'handover' => true, 'reason' => 'The AI declined to answer this message.'];
        }

        foreach ($response->content as $block) {
            if ($block->type === 'text') {
                return ReplySchema::parse($block->text);
            }
        }

        throw new \RuntimeException('Claude returned no text content.');
    }

    public function name(): string
    {
        return 'anthropic';
    }
}
