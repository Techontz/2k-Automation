<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Services\Automation\NodeResult;
use App\Services\Messaging\ConversationService;

/**
 * Flags the conversation for a human and pauses AI replies.
 */
class HandoverNode implements NodeHandler
{
    public function __construct(private readonly ConversationService $conversations) {}

    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $conversation = $this->conversations->forContact($run->contact->channel, $run->contact);
        $conversation->forceFill([
            'needs_human' => true,
            'ai_paused' => true,
            'status' => 'open',
            'assigned_user_id' => $data['assign_user_id'] ?? $conversation->assigned_user_id,
        ])->save();

        return NodeResult::next('Handed over to the team'.(isset($data['note']) ? ': '.$data['note'] : ''));
    }
}
