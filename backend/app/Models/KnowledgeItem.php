<?php

namespace App\Models;

use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['workspace_id', 'title', 'content', 'enabled'])]
class KnowledgeItem extends Model
{
    use BelongsToWorkspace;

    protected function casts(): array
    {
        return ['enabled' => 'boolean'];
    }
}
