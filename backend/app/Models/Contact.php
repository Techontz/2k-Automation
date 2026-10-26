<?php

namespace App\Models;

use App\Enums\ConsentType;
use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'workspace_id', 'channel_id', 'platform', 'external_id', 'is_simulated', 'name', 'username', 'avatar_url',
    'email', 'phone', 'locale', 'custom_fields', 'last_inbound_at', 'last_interaction_at', 'unsubscribed',
])]
class Contact extends Model
{
    use BelongsToWorkspace, HasFactory;

    protected function casts(): array
    {
        return [
            'is_simulated' => 'boolean',
            'custom_fields' => 'array',
            'last_inbound_at' => 'datetime',
            'last_interaction_at' => 'datetime',
            'unsubscribed' => 'boolean',
        ];
    }

    /**
     * @return BelongsTo<Channel, $this>
     */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }

    /**
     * @return BelongsToMany<Tag, $this>
     */
    public function tags(): BelongsToMany
    {
        return $this->belongsToMany(Tag::class);
    }

    /**
     * @return HasMany<Consent, $this>
     */
    public function consents(): HasMany
    {
        return $this->hasMany(Consent::class);
    }

    /**
     * The latest consent record of a type decides the current state (append-only ledger).
     */
    public function hasConsent(ConsentType $type): bool
    {
        $latest = $this->consents()->where('type', $type->value)->latest('recorded_at')->latest('id')->first();

        return $latest?->status === 'granted';
    }

    public function displayName(): string
    {
        return $this->name ?: ($this->username ? '@'.$this->username : 'Contact #'.$this->id);
    }
}
