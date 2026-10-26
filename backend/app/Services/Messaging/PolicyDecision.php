<?php

namespace App\Services\Messaging;

final readonly class PolicyDecision
{
    private function __construct(
        public bool $allowed,
        public string $mode,
        public ?string $reason = null,
        public ?string $tag = null,
    ) {}

    public static function allow(string $mode, ?string $tag = null): self
    {
        return new self(true, $mode, null, $tag);
    }

    public static function deny(string $reason): self
    {
        return new self(false, 'blocked', $reason);
    }
}
