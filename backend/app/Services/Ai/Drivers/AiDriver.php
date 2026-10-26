<?php

namespace App\Services\Ai\Drivers;

interface AiDriver
{
    /**
     * Generate a structured reply.
     *
     * @param  list<array{role: 'user'|'assistant', content: string}>  $messages
     * @return array{reply: string, confidence: float, language: string, handover: bool, reason: string|null}
     */
    public function generate(string $system, array $messages, string $model, string $apiKey): array;

    public function name(): string;
}
