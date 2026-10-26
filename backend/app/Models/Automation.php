<?php

namespace App\Models;

use App\Enums\AutomationStatus;
use App\Enums\TriggerType;
use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'workspace_id', 'created_by', 'name', 'description', 'status', 'trigger_type', 'trigger_config', 'flow',
    'priority', 'runs_count', 'completed_count', 'failed_count', 'last_run_at',
])]
class Automation extends Model
{
    use BelongsToWorkspace, HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'status' => AutomationStatus::class,
            'trigger_type' => TriggerType::class,
            'trigger_config' => 'array',
            'flow' => 'array',
            'last_run_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<AutomationRun, $this>
     */
    public function runs(): HasMany
    {
        return $this->hasMany(AutomationRun::class);
    }
}
