<?php

namespace App\Services\Ai;

use App\Models\AiSetting;
use App\Models\Conversation;
use App\Models\KnowledgeItem;
use App\Models\Workspace;
use App\Services\Ai\Drivers\AiDriver;
use App\Services\Ai\Drivers\AnthropicDriver;
use App\Services\Ai\Drivers\KnowledgeBaseDriver;
use App\Services\Ai\Drivers\OpenAiDriver;
use Throwable;

/**
 * Produces brand-voiced replies grounded in the workspace knowledge base,
 * in English or Swahili, and decides when to hand over to a human.
 */
class AiResponder
{
    public function __construct(private readonly KnowledgeBaseDriver $fallback) {}

    public function respond(Workspace $workspace, ?Conversation $conversation, string $question, string $extraInstructions = ''): AiReply
    {
        $settings = AiSetting::forWorkspaceOrDefault($workspace);

        foreach ($settings->handover_keywords ?? [] as $keyword) {
            if ($keyword !== '' && str_contains(mb_strtolower($question), mb_strtolower($keyword))) {
                return AiReply::handover("Contact asked for a human (\"{$keyword}\").", 'rules');
            }
        }

        $knowledge = KnowledgeItem::forWorkspace($workspace)->where('enabled', true)->latest()->limit(40)->get();
        [$driver, $apiKey, $model] = $this->driverFor($settings);

        try {
            $result = $driver
                ? $driver->generate($this->systemPrompt($settings, $knowledge, $extraInstructions), $this->history($conversation, $question), $model, $apiKey)
                : $this->fallback->answer($question, $knowledge, $settings->assistant_name);
        } catch (Throwable $exception) {
            report($exception);

            return AiReply::handover('AI provider unavailable: '.mb_strimwidth($exception->getMessage(), 0, 160, '…'), $driver?->name() ?? 'built-in');
        }

        $provider = $driver?->name() ?? 'built-in';

        if ($result['handover'] || $result['reply'] === '') {
            return AiReply::handover($result['reason'] ?: 'AI requested a human.', $provider, $result['language']);
        }

        if ($result['confidence'] < $settings->confidence_threshold) {
            return AiReply::handover(sprintf('Confidence %.0f%% is below the %.0f%% threshold.', $result['confidence'] * 100, $settings->confidence_threshold * 100), $provider, $result['language']);
        }

        return new AiReply($result['reply'], $result['confidence'], $result['language'], false, null, $provider);
    }

    /**
     * @return array{0: AiDriver|null, 1: string, 2: string}
     */
    private function driverFor(AiSetting $settings): array
    {
        $provider = $settings->provider === 'openai' ? 'openai' : 'anthropic';
        $apiKey = $settings->api_key ?: (string) config("services.{$provider}.key");
        $model = $settings->model ?: (string) config("services.{$provider}.model");

        if ($apiKey === '') {
            return [null, '', ''];
        }

        return [$provider === 'openai' ? app(OpenAiDriver::class) : app(AnthropicDriver::class), $apiKey, $model];
    }

    /**
     * @param  iterable<KnowledgeItem>  $knowledge
     */
    private function systemPrompt(AiSetting $settings, iterable $knowledge, string $extraInstructions): string
    {
        $languages = implode(' and ', array_map(fn (string $code): string => ['en' => 'English', 'sw' => 'Swahili'][$code] ?? $code, $settings->languages ?? ['en']));
        $facts = collect($knowledge)->map(fn (KnowledgeItem $item): string => "## {$item->title}\n{$item->content}")->implode("\n\n");

        return trim(<<<PROMPT
        You are {$settings->assistant_name}, replying to customers in a social media inbox (Instagram, Facebook, WhatsApp) on behalf of a business.

        Brand voice: {$settings->brand_voice}

        Reply in the customer's language. Supported languages: {$languages}. Keep replies short and conversational, suitable for a chat message (under 600 characters), with no markdown.

        Only state facts found in the knowledge base below. If the answer is not there, or the customer is upset, asks for a refund, reports a problem with an order, or asks for a person, set handover to true and write a brief, polite holding message. Never invent prices, links, dates or policies. Never ask for passwords or payment card details.

        Set confidence to how sure you are that the reply is correct and fully supported by the knowledge base.

        {$settings->extra_instructions}
        {$extraInstructions}

        # Knowledge base
        {$facts}
        PROMPT);
    }

    /**
     * Last messages of the conversation, merged into alternating turns ending with the question.
     *
     * @return list<array{role: 'user'|'assistant', content: string}>
     */
    private function history(?Conversation $conversation, string $question): array
    {
        $turns = [];

        $recent = $conversation?->messages()->whereIn('kind', ['dm', 'private_reply'])->whereNotNull('body')->latest('id')->limit(12)->get()->reverse() ?? [];

        foreach ($recent as $message) {
            $role = $message->direction === 'in' ? 'user' : 'assistant';

            if ($turns !== [] && end($turns)['role'] === $role) {
                $turns[array_key_last($turns)]['content'] .= "\n".$message->body;
            } else {
                $turns[] = ['role' => $role, 'content' => (string) $message->body];
            }
        }

        while ($turns !== [] && $turns[0]['role'] === 'assistant') {
            array_shift($turns);
        }

        if ($turns === [] || end($turns)['role'] !== 'user' || ! str_contains(end($turns)['content'], $question)) {
            $turns[] = ['role' => 'user', 'content' => $question];
        }

        return $turns;
    }
}
