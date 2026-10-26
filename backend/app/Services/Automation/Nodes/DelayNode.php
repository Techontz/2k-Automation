<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Services\Automation\NodeResult;

class DelayNode implements NodeHandler
{
    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $amount = max(1, (int) ($data['amount'] ?? 1));
        $unit = in_array($data['unit'] ?? null, ['seconds', 'minutes', 'hours', 'days'], true) ? $data['unit'] : 'minutes';

        return NodeResult::wait('delay', "Waiting {$amount} {$unit}", now()->add($unit, $amount));
    }
}
