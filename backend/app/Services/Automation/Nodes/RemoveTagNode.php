<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Models\Tag;
use App\Services\Automation\NodeResult;

class RemoveTagNode implements NodeHandler
{
    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $name = trim((string) $data['tag']);
        $tag = Tag::forWorkspace($run->workspace_id)->where('name', $name)->first();

        if ($tag) {
            $run->contact->tags()->detach($tag->id);
        }

        return NodeResult::next("Removed tag \"{$name}\"");
    }
}
