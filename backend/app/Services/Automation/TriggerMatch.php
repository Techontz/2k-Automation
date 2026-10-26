<?php

namespace App\Services\Automation;

use App\Models\Automation;

final readonly class TriggerMatch
{
    public function __construct(
        public Automation $automation,
        public ?string $keyword,
    ) {}
}
