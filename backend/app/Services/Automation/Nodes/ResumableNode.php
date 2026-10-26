<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Services\Automation\NodeResult;

/**
 * Nodes that pause for the contact's reply. $input is null on timeout.
 */
interface ResumableNode extends NodeHandler
{
    /**
     * @param  array<string, mixed>  $data
     */
    public function resume(AutomationRun $run, array $data, ?string $input): NodeResult;
}
