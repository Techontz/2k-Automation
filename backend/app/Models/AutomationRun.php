<?php

namespace App\Models;

use App\Enums\RunStatus;
use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable([
    'workspace_id', 'automation_id', 'contact_id', 'conversation_id', 'comment_id', 'webhook_event_id',
    'is_simulated', 'status', 'current_node_id', 'waiting_for', 'resume_at', 'context', 'error', 'started_at', 'finished_at',
])]
class AutomationRun extends Model
{
    use BelongsToWorkspace;

    protected function casts(): array
    {
        return [
            'is_simulated' => 'boolean',
            'status' => RunStatus::class,
            'context' => 'array',
            'resume_at' => 'datetime',
            'started_at' => 'datetime',
            'finished_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Automation, $this>
     */
    public function automation(): BelongsTo
    {
        return $this->belongsTo(Automation::class)->withTrashed();
    }

    /**
     * @return BelongsTo<Contact, $this>
     */
    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }

    /**
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * @return BelongsTo<Comment, $this>
     */
    public function comment(): BelongsTo
    {
        return $this->belongsTo(Comment::class);
    }

    /**
     * @return HasMany<AutomationRunStep, $this>
     */
    public function steps(): HasMany
    {
        return $this->hasMany(AutomationRunStep::class)->orderBy('id');
    }
}
