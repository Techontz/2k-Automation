<?php

namespace App\Models;

use App\Enums\MessageKind;
use App\Enums\MessageStatus;
use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'workspace_id', 'conversation_id', 'comment_id', 'channel_id', 'contact_id', 'automation_run_id',
    'sent_by_user_id', 'is_simulated', 'direction', 'kind', 'source', 'body', 'payload', 'status',
    'external_id', 'error_code', 'error_message', 'sent_at',
])]
class Message extends Model
{
    use BelongsToWorkspace;

    protected function casts(): array
    {
        return [
            'is_simulated' => 'boolean',
            'kind' => MessageKind::class,
            'status' => MessageStatus::class,
            'payload' => 'array',
            'sent_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Conversation, $this>
     */
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by_user_id');
    }
}
