<?php

namespace App\Models;

use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'workspace_id', 'email_campaign_id', 'email_template_id', 'contact_id', 'automation_run_id',
    'to_email', 'subject', 'status', 'error', 'sent_at',
])]
class EmailSend extends Model
{
    use BelongsToWorkspace;

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<Contact, $this>
     */
    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }
}
