<?php

namespace App\Console\Commands;

use App\Enums\RunStatus;
use App\Jobs\ExecuteAutomationRun;
use App\Models\AutomationRun;
use App\Services\Automation\FlowExecutor;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('automations:resume-due')]
#[Description('Resume runs whose delay elapsed and time out runs waiting for replies')]
class ResumeDueAutomationRuns extends Command
{
    public function handle(FlowExecutor $executor): int
    {
        $due = AutomationRun::query()
            ->where('status', RunStatus::Waiting)
            ->whereNotNull('resume_at')
            ->where('resume_at', '<=', now())
            ->limit(500)
            ->get();

        foreach ($due as $run) {
            if ($run->waiting_for === 'delay') {
                ExecuteAutomationRun::dispatch($run->id)->onQueue(config('automation.queues.automations'));
            } else {
                $executor->resume($run, null);
            }
        }

        $this->info("Processed {$due->count()} due runs.");

        return self::SUCCESS;
    }
}
