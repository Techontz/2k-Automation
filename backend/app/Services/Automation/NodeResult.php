<?php

namespace App\Services\Automation;

use Illuminate\Support\Carbon;

final readonly class NodeResult
{
    /**
     * @param  array<string, mixed>  $output
     */
    private function __construct(
        public string $status,
        public ?string $handle,
        public ?string $summary,
        public array $output = [],
        public ?string $waitingFor = null,
        public ?Carbon $resumeAt = null,
    ) {}

    /**
     * @param  array<string, mixed>  $output
     */
    public static function next(string $summary, array $output = [], string $handle = 'default'): self
    {
        return new self('completed', $handle, $summary, $output);
    }

    /**
     * Policy prevented the action; the flow continues so later steps still run.
     *
     * @param  array<string, mixed>  $output
     */
    public static function blocked(string $summary, array $output = [], string $handle = 'default'): self
    {
        return new self('blocked', $handle, $summary, $output);
    }

    /**
     * @param  array<string, mixed>  $output
     */
    public static function failed(string $summary, array $output = [], string $handle = 'default'): self
    {
        return new self('failed', $handle, $summary, $output);
    }

    public static function wait(string $waitingFor, string $summary, ?Carbon $resumeAt = null): self
    {
        return new self('waiting', null, $summary, [], $waitingFor, $resumeAt);
    }

    public static function end(string $summary): self
    {
        return new self('completed', null, $summary);
    }
}
