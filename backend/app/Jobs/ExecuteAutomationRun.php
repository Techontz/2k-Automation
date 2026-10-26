<?php

namespace App\Jobs;

use App\Models\AutomationRun;
use App\Services\Automation\FlowExecutor;
use App\Services\Platforms\PlatformException;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Advances one automation run. Rate limits release the job with the
 * platform's suggested delay; the run resumes at the node that failed.
 */
class ExecuteAutomationRun implements ShouldQueue
{
    use Queueable;

    public int $tries = 6;

    public function __construct(public int $runId) {}

    public function handle(FlowExecutor $executor): void
    {
        $run = AutomationRun::find($this->runId);

        if (! $run) {
            return;
        }

        try {
            $executor->advance($run);
        } catch (PlatformException $exception) {
            if ($exception->isRetryable() && $this->attempts() < $this->tries && $this->job?->getConnectionName() !== 'sync') {
                $this->release($exception->retryAfterSeconds);

                return;
            }

            $executor->fail($run->refresh(), $exception->getMessage());
        }
    }

    public function failed(Throwable $exception): void
    {
        if ($run = AutomationRun::find($this->runId)) {
            app(FlowExecutor::class)->fail($run, mb_strimwidth($exception->getMessage(), 0, 1000));
        }
    }
}
