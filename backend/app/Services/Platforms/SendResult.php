<?php

namespace App\Services\Platforms;

final readonly class SendResult
{
    /**
     * @param  array<string, mixed>  $raw
     */
    public function __construct(
        public ?string $externalId,
        public array $raw = [],
    ) {}
}
