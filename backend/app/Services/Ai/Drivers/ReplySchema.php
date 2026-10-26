<?php

namespace App\Services\Ai\Drivers;

final class ReplySchema
{
    /**
     * JSON schema every provider is asked to fill.
     *
     * @return array<string, mixed>
     */
    public static function schema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'reply' => ['type' => 'string', 'description' => 'Message to send to the customer, in their language.'],
                'confidence' => ['type' => 'number', 'description' => '0-1: how certain the reply is correct and grounded in the knowledge provided.'],
                'language' => ['type' => 'string', 'enum' => ['en', 'sw', 'other']],
                'handover' => ['type' => 'boolean', 'description' => 'True when a human should take over.'],
                'reason' => ['type' => ['string', 'null'], 'description' => 'Why a handover is needed, otherwise null.'],
            ],
            'required' => ['reply', 'confidence', 'language', 'handover', 'reason'],
            'additionalProperties' => false,
        ];
    }

    /**
     * @return array{reply: string, confidence: float, language: string, handover: bool, reason: string|null}
     */
    public static function parse(string $json): array
    {
        $data = json_decode($json, true);

        if (! is_array($data) || ! isset($data['reply'])) {
            throw new \RuntimeException('AI response was not valid JSON.');
        }

        return [
            'reply' => trim((string) $data['reply']),
            'confidence' => max(0.0, min(1.0, (float) ($data['confidence'] ?? 0))),
            'language' => (string) ($data['language'] ?? 'en'),
            'handover' => (bool) ($data['handover'] ?? false),
            'reason' => isset($data['reason']) ? (string) $data['reason'] : null,
        ];
    }
}
