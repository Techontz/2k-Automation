<?php

namespace App\Services\Automation;

use App\Enums\RunStatus;
use App\Jobs\ExecuteAutomationRun;
use App\Models\Automation;
use App\Models\AutomationRun;
use App\Models\AutomationRunStep;
use App\Models\Comment;
use App\Models\Contact;
use App\Models\Conversation;
use App\Services\Automation\Nodes\NodeHandler;
use App\Services\Automation\Nodes\ResumableNode;
use Illuminate\Support\Facades\Cache;

/**
 * Walks an automation's flow graph for one contact. The current node is
 * persisted after every step, so a run can be retried or resumed safely.
 */
class FlowExecutor
{
    /**
     * Delayed resumptions queued while a run lock is held; dispatched after release.
     *
     * @var list<array{0: AutomationRun, 1: \DateTimeInterface}>
     */
    private array $deferred = [];

    public function __construct(private readonly NodeRegistry $registry) {}

    /**
     * @param  array<string, mixed>  $trigger
     */
    public function start(Automation $automation, Contact $contact, array $trigger, ?Comment $comment = null, ?Conversation $conversation = null, ?int $webhookEventId = null): AutomationRun
    {
        $graph = new FlowGraph($automation->flow);
        $triggerId = $graph->triggerId();

        $run = AutomationRun::create([
            'workspace_id' => $automation->workspace_id,
            'automation_id' => $automation->id,
            'contact_id' => $contact->id,
            'conversation_id' => $conversation?->id,
            'comment_id' => $comment?->id,
            'webhook_event_id' => $webhookEventId,
            'is_simulated' => (bool) $contact->is_simulated,
            'status' => RunStatus::Running,
            'current_node_id' => $triggerId ? $graph->next($triggerId) : null,
            'context' => ['trigger' => $trigger, 'vars' => []],
            'started_at' => now(),
        ]);

        $automation->increment('runs_count', 1, ['last_run_at' => now()]);

        $this->logStep($run, $triggerId ?? 'trigger', 'trigger', 'completed', $this->describeTrigger($trigger));

        if ($run->current_node_id === null) {
            $this->complete($run);
        } else {
            $this->dispatch($run);
        }

        return $run;
    }

    /**
     * Execute steps until the flow ends or pauses. Called by ExecuteAutomationRun.
     */
    public function advance(AutomationRun $run): void
    {
        try {
            $this->advanceLocked($run);
        } finally {
            $deferred = $this->deferred;
            $this->deferred = [];

            foreach ($deferred as [$deferredRun, $at]) {
                $this->dispatch($deferredRun, $at);
            }
        }
    }

    private function advanceLocked(AutomationRun $run): void
    {
        Cache::lock("automation-run:{$run->id}", 120)->block(10, function () use ($run): void {
            $run->refresh();

            if ($run->status === RunStatus::Waiting && $run->waiting_for === 'delay' && $run->resume_at?->isPast()) {
                $run->forceFill(['status' => RunStatus::Running, 'waiting_for' => null, 'resume_at' => null])->save();
            }

            if ($run->status !== RunStatus::Running) {
                return;
            }

            $graph = new FlowGraph($run->automation->flow);
            $limit = (int) config('automation.max_steps_per_run');

            for ($steps = 0; ; $steps++) {
                $node = $graph->node($run->current_node_id);

                if ($node === null) {
                    $this->complete($run);

                    return;
                }

                if ($steps >= $limit) {
                    $this->fail($run, 'Step limit reached — check the flow for loops.');

                    return;
                }

                $handler = $this->registry->for((string) $node['type']);

                if (! $handler instanceof NodeHandler) {
                    $this->fail($run, "Unknown step type \"{$node['type']}\".");

                    return;
                }

                $started = hrtime(true);
                $result = $handler->handle($run, $node['data'] ?? []);
                $this->logStep($run, (string) $node['id'], (string) $node['type'], $result->status, $result->summary, $result->output, $started);

                if (! $this->apply($run, $graph, $node, $result)) {
                    return;
                }
            }
        });
    }

    /**
     * Continue a run that was waiting for the contact's reply (null input = timed out).
     */
    public function resume(AutomationRun $run, ?string $input): void
    {
        $graph = new FlowGraph($run->automation->flow);
        $node = $graph->node($run->current_node_id);
        $handler = $node ? $this->registry->for((string) $node['type']) : null;

        if (! $handler instanceof ResumableNode) {
            $this->fail($run, 'Waiting step can no longer be resumed.');

            return;
        }

        $context = $run->context;
        $context['last_input'] = $input;
        $run->forceFill(['status' => RunStatus::Running, 'waiting_for' => null, 'resume_at' => null, 'context' => $context])->save();

        $started = hrtime(true);
        $result = $handler->resume($run, $node['data'] ?? [], $input);
        $this->logStep($run, (string) $node['id'], (string) $node['type'], $result->status, $result->summary, $result->output, $started);

        if ($this->apply($run, $graph, $node, $result)) {
            $this->dispatch($run);
        }
    }

    public function cancel(AutomationRun $run, string $reason): void
    {
        if (! $run->status->isFinished()) {
            $run->forceFill(['status' => RunStatus::Cancelled, 'error' => $reason, 'finished_at' => now()])->save();
        }
    }

    public function fail(AutomationRun $run, string $error): void
    {
        $run->forceFill(['status' => RunStatus::Failed, 'error' => $error, 'finished_at' => now()])->save();
        $run->automation()->increment('failed_count');
    }

    /**
     * @param  array<string, mixed>  $node
     * @return bool Whether execution should continue immediately.
     */
    private function apply(AutomationRun $run, FlowGraph $graph, array $node, NodeResult $result): bool
    {
        if ($result->status === 'waiting') {
            $run->forceFill([
                'status' => RunStatus::Waiting,
                'waiting_for' => $result->waitingFor,
                'resume_at' => $result->resumeAt,
                'current_node_id' => $result->waitingFor === 'delay' ? $graph->next((string) $node['id']) : $run->current_node_id,
            ])->save();

            if ($result->waitingFor === 'delay') {
                $this->deferred[] = [$run, $result->resumeAt];
            }

            return false;
        }

        $next = $result->handle === null ? null : $graph->next((string) $node['id'], $result->handle);
        $run->forceFill(['current_node_id' => $next])->save();

        if ($next === null) {
            $this->complete($run);

            return false;
        }

        return true;
    }

    private function complete(AutomationRun $run): void
    {
        $run->forceFill(['status' => RunStatus::Completed, 'current_node_id' => null, 'finished_at' => now()])->save();
        $run->automation()->increment('completed_count');
    }

    private function dispatch(AutomationRun $run, ?\DateTimeInterface $at = null): void
    {
        if ($at === null && $run->is_simulated && config('automation.simulator_sync')) {
            ExecuteAutomationRun::dispatchSync($run->id);

            return;
        }

        $job = ExecuteAutomationRun::dispatch($run->id)->onQueue(config('automation.queues.automations'));

        if ($at !== null) {
            $job->delay($at);
        }
    }

    /**
     * @param  array<string, mixed>  $output
     */
    private function logStep(AutomationRun $run, string $nodeId, string $type, string $status, ?string $summary, array $output = [], ?int $started = null): void
    {
        AutomationRunStep::create([
            'automation_run_id' => $run->id,
            'node_id' => $nodeId,
            'node_type' => $type,
            'status' => $status,
            'summary' => $summary,
            'output' => $output ?: null,
            'error' => $status === 'failed' ? $summary : null,
            'duration_ms' => $started ? (int) ((hrtime(true) - $started) / 1_000_000) : 0,
            'created_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $trigger
     */
    private function describeTrigger(array $trigger): string
    {
        $what = match ($trigger['type'] ?? null) {
            'comment' => 'Comment',
            'story_reply' => 'Story reply',
            default => 'Message',
        };

        return trim("{$what} \"".mb_strimwidth((string) ($trigger['text'] ?? ''), 0, 80, '…').'"'
            .(isset($trigger['keyword']) ? " matched keyword \"{$trigger['keyword']}\"" : ''));
    }
}
