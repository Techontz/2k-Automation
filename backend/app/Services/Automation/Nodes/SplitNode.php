<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Services\Automation\NodeResult;

/**
 * Randomised A/B split for testing message variants.
 */
class SplitNode implements NodeHandler
{
    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $percentA = max(0, min(100, (int) ($data['percent_a'] ?? 50)));
        $branch = random_int(1, 100) <= $percentA ? 'a' : 'b';

        return NodeResult::next('Assigned to variant '.strtoupper($branch), ['branch' => $branch], $branch);
    }
}
