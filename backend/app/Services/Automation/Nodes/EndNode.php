<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Services\Automation\NodeResult;

class EndNode implements NodeHandler
{
    public function handle(AutomationRun $run, array $data): NodeResult
    {
        return NodeResult::end('Flow ended');
    }
}
