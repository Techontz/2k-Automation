<?php

namespace App\Services\Ai\Drivers;

use Illuminate\Support\Facades\Http;

class OpenAiDriver implements AiDriver
{
    public function generate(string $system, array $messages, string $model, string $apiKey): array
    {
        $response = Http::withToken($apiKey)
            ->timeout(45)
            ->retry(2, 1000, throw: false)
            ->post('https://api.openai.com/v1/chat/completions', [
                'model' => $model,
                'messages' => [['role' => 'system', 'content' => $system], ...$messages],
                'response_format' => [
                    'type' => 'json_schema',
                    'json_schema' => ['name' => 'reply', 'strict' => true, 'schema' => ReplySchema::schema()],
                ],
            ])
            ->throw();

        return ReplySchema::parse((string) $response->json('choices.0.message.content'));
    }

    public function name(): string
    {
        return 'openai';
    }
}
