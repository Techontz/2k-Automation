<?php

namespace App\Services\Automation\Nodes;

use App\Enums\MessageStatus;
use App\Models\AutomationRun;
use App\Models\Message;
use App\Services\Automation\NodeResult;

/**
 * Shared helpers for nodes that send messages.
 */
trait SendsMessages
{
    /**
     * @return array{source: string, automation_run_id: int}
     */
    protected function meta(AutomationRun $run): array
    {
        return ['source' => 'automation', 'automation_run_id' => $run->id];
    }

    /**
     * @return array<string, mixed>
     */
    protected function variables(AutomationRun $run): array
    {
        return [
            'keyword' => $run->context['trigger']['keyword'] ?? '',
            ...($run->context['vars'] ?? []),
        ];
    }

    protected function resultFor(Message $message, string $successSummary, string $handle = 'default'): NodeResult
    {
        $output = ['message_id' => $message->id, 'kind' => $message->kind->value, 'status' => $message->status->value];

        return match ($message->status) {
            MessageStatus::Sent, MessageStatus::Delivered, MessageStatus::Read => NodeResult::next($successSummary, $output, $handle),
            MessageStatus::Blocked => NodeResult::blocked('Not sent: '.$message->error_message, $output, $handle),
            default => NodeResult::failed('Send failed: '.$message->error_message, $output, $handle),
        };
    }
}
