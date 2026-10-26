<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;

class AuditLogger
{
    /**
     * @param  array<string, mixed>  $properties
     */
    public static function log(string $action, ?Model $subject = null, array $properties = [], ?int $workspaceId = null): void
    {
        $request = request();

        AuditLog::create([
            'workspace_id' => $workspaceId ?? $subject?->getAttribute('workspace_id') ?? $request->attributes->get('workspace')?->id,
            'user_id' => $request->user()?->id,
            'action' => $action,
            'subject_type' => $subject?->getMorphClass(),
            'subject_id' => $subject?->getKey(),
            'properties' => $properties ?: null,
            'ip_address' => $request->ip(),
            'created_at' => now(),
        ]);
    }
}
