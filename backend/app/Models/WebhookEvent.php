<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['platform', 'dedupe_key', 'channel_id', 'is_simulated', 'event_type', 'payload', 'status', 'attempts', 'outcome', 'error', 'processed_at'])]
class WebhookEvent extends Model
{
    protected function casts(): array
    {
        return [
            'is_simulated' => 'boolean',
            'payload' => 'array',
            'processed_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Channel, $this>
     */
    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class);
    }
}
