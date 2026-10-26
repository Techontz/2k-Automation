<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Models\Tag;
use App\Services\Automation\NodeResult;

class AddTagNode implements NodeHandler
{
    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $name = trim((string) $data['tag']);
        $tag = Tag::firstOrCreate(['workspace_id' => $run->workspace_id, 'name' => $name]);
        $run->contact->tags()->syncWithoutDetaching([$tag->id]);

        return NodeResult::next("Added tag \"{$name}\"");
    }
}
