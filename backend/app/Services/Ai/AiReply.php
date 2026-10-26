<?php

namespace App\Services\Ai;

final readonly class AiReply
{
    public function __construct(
        public string $text,
        public float $confidence,
        public string $language,
        public bool $shouldHandover,
        public ?string $handoverReason,
        public string $provider,
    ) {}

    public static function handover(string $reason, string $provider, string $language = 'en'): self
    {
        return new self('', 0.0, $language, true, $reason, $provider);
    }
}
