<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\WithoutTimestamps;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['automation_run_id', 'node_id', 'node_type', 'status', 'summary', 'output', 'error', 'duration_ms', 'created_at'])]
#[WithoutTimestamps]
class AutomationRunStep extends Model
{
    protected function casts(): array
    {
        return [
            'output' => 'array',
            'created_at' => 'datetime',
        ];
    }
}
