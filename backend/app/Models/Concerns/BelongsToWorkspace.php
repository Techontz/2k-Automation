<?php

namespace App\Models\Concerns;

use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Tenant-owned models. Queries from controllers must always go through forWorkspace().
 */
trait BelongsToWorkspace
{
    /**
     * @return BelongsTo<Workspace, $this>
     */
    public function workspace(): BelongsTo
    {
        return $this->belongsTo(Workspace::class);
    }

    /**
     * @param  Builder<static>  $query
     */
    public function scopeForWorkspace(Builder $query, Workspace|int $workspace): void
    {
        $query->where($this->getTable().'.workspace_id', $workspace instanceof Workspace ? $workspace->id : $workspace);
    }
}
