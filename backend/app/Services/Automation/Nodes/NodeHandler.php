<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Services\Automation\NodeResult;

interface NodeHandler
{
    /**
     * @param  array<string, mixed>  $data  Node configuration from the flow builder.
     */
    public function handle(AutomationRun $run, array $data): NodeResult;
}
