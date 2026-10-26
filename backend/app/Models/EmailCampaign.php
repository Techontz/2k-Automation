<?php

namespace App\Models;

use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'workspace_id', 'email_template_id', 'email_provider_id', 'name', 'audience', 'status', 'scheduled_at',
    'sent_at', 'recipients_count', 'sent_count', 'failed_count', 'skipped_count',
])]
class EmailCampaign extends Model
{
    use BelongsToWorkspace;

    protected function casts(): array
    {
        return [
            'audience' => 'array',
            'scheduled_at' => 'datetime',
            'sent_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<EmailTemplate, $this>
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(EmailTemplate::class, 'email_template_id');
    }

    /**
     * @return BelongsTo<EmailProvider, $this>
     */
    public function provider(): BelongsTo
    {
        return $this->belongsTo(EmailProvider::class, 'email_provider_id');
    }

    /**
     * @return HasMany<EmailSend, $this>
     */
    public function sends(): HasMany
    {
        return $this->hasMany(EmailSend::class);
    }
}
