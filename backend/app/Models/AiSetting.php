<?php

namespace App\Models;

use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;

#[Fillable([
    'workspace_id', 'enabled', 'provider', 'model', 'api_key', 'assistant_name', 'brand_voice', 'languages',
    'confidence_threshold', 'handover_keywords', 'extra_instructions', 'auto_reply_dms',
])]
#[Hidden(['api_key'])]
class AiSetting extends Model
{
    use BelongsToWorkspace;

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'api_key' => 'encrypted',
            'languages' => 'array',
            'confidence_threshold' => 'float',
            'handover_keywords' => 'array',
            'auto_reply_dms' => 'boolean',
        ];
    }

    public static function forWorkspaceOrDefault(Workspace $workspace): self
    {
        return self::firstOrCreate(['workspace_id' => $workspace->id], [
            'languages' => ['en', 'sw'],
            'handover_keywords' => ['human', 'agent', 'mtu', 'help me'],
        ]);
    }
}
