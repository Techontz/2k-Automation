<?php

namespace App\Models;

use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'workspace_id', 'channel_id', 'post_id', 'contact_id', 'external_id', 'parent_external_id', 'is_simulated',
    'text', 'matched_keyword', 'commented_at', 'public_replied_at', 'private_replied_at',
])]
class Comment extends Model
{
    use BelongsToWorkspace;

    protected function casts(): array
    {
        return [
            'is_simulated' => 'boolean',
            'commented_at' => 'datetime',
            'public_replied_at' => 'datetime',
            'private_replied_at' => 'datetime',
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
     * @return BelongsTo<Post, $this>
     */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    /**
     * @return BelongsTo<Contact, $this>
     */
    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }
}
