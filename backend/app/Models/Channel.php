<?php

namespace App\Models;

use App\Enums\Platform;
use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'workspace_id', 'platform', 'is_simulated', 'external_id', 'name', 'username', 'avatar_url',
    'access_token', 'token_expires_at', 'scopes', 'status', 'status_reason', 'meta', 'last_webhook_at',
])]
#[Hidden(['access_token'])]
class Channel extends Model
{
    use BelongsToWorkspace, HasFactory;

    protected function casts(): array
    {
        return [
            'platform' => Platform::class,
            'is_simulated' => 'boolean',
            'access_token' => 'encrypted',
            'token_expires_at' => 'datetime',
            'scopes' => 'array',
            'meta' => 'array',
            'last_webhook_at' => 'datetime',
        ];
    }

    /**
     * @return HasMany<Post, $this>
     */
    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }

    public function isActive(): bool
    {
        return $this->status === 'connected';
    }

    public function metaValue(string $key, mixed $default = null): mixed
    {
        return data_get($this->meta, $key, $default);
    }
}
