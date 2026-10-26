<?php

namespace App\Models;

use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['workspace_id', 'name', 'subject', 'body_html', 'body_text', 'category'])]
class EmailTemplate extends Model
{
    use BelongsToWorkspace;
}
