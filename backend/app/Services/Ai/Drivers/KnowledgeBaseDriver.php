<?php

namespace App\Services\Ai\Drivers;

use App\Models\KnowledgeItem;

/**
 * Credential-free fallback used when no AI key is configured. Scores knowledge
 * base entries by word overlap and answers with the best match, so the AI
 * assistant and simulator work end-to-end before keys are added.
 */
class KnowledgeBaseDriver
{
    /**
     * @param  iterable<KnowledgeItem>  $items
     * @return array{reply: string, confidence: float, language: string, handover: bool, reason: string|null}
     */
    public function answer(string $question, iterable $items, string $assistantName): array
    {
        $language = $this->detectLanguage($question);
        $words = $this->words($question);
        $best = null;
        $bestScore = 0.0;

        foreach ($items as $item) {
            $itemWords = $this->words($item->title.' '.$item->content);
            $overlap = count(array_intersect($words, $itemWords));
            $score = $words === [] ? 0 : $overlap / count($words);

            if ($score > $bestScore) {
                [$best, $bestScore] = [$item, $score];
            }
        }

        if ($best === null || $bestScore < 0.2) {
            return [
                'reply' => $language === 'sw'
                    ? 'Asante kwa ujumbe wako! Mtu kutoka timu yetu atakujibu hivi karibuni.'
                    : 'Thanks for your message! Someone from our team will get back to you shortly.',
                'confidence' => 0.2,
                'language' => $language,
                'handover' => true,
                'reason' => 'No matching knowledge base entry.',
            ];
        }

        return [
            'reply' => mb_strimwidth(trim($best->content), 0, 900, '…'),
            'confidence' => round(min(0.95, 0.5 + $bestScore / 2), 2),
            'language' => $language,
            'handover' => false,
            'reason' => null,
        ];
    }

    /**
     * @return list<string>
     */
    private function words(string $text): array
    {
        $stop = ['the', 'a', 'an', 'is', 'are', 'do', 'you', 'i', 'to', 'of', 'and', 'what', 'how', 'na', 'ya', 'wa', 'ni', 'je', 'kwa'];
        preg_match_all('/[\p{L}\p{N}]{2,}/u', mb_strtolower($text), $matches);

        return array_values(array_unique(array_diff($matches[0], $stop)));
    }

    private function detectLanguage(string $text): string
    {
        $swahili = ['habari', 'asante', 'tafadhali', 'bei', 'gani', 'nataka', 'naomba', 'karibu', 'sasa', 'mambo', 'je', 'ninaweza', 'wapi', 'lini'];

        return count(array_intersect($this->words($text), $swahili)) > 0 ? 'sw' : 'en';
    }
}
