<?php

namespace App\Models;

use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['workspace_id', 'driver', 'name', 'from_name', 'from_email', 'credentials', 'is_default', 'status'])]
#[Hidden(['credentials'])]
class EmailProvider extends Model
{
    use BelongsToWorkspace;

    protected function casts(): array
    {
        return [
            'credentials' => 'encrypted:array',
            'is_default' => 'boolean',
        ];
    }
}
