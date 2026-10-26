<?php

namespace App\Models;

use App\Enums\ConsentType;
use App\Models\Concerns\BelongsToWorkspace;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['workspace_id', 'contact_id', 'type', 'status', 'source', 'evidence', 'ip_address', 'recorded_at'])]
class Consent extends Model
{
    use BelongsToWorkspace;

    protected function casts(): array
    {
        return [
            'type' => ConsentType::class,
            'recorded_at' => 'datetime',
        ];
    }

    /**
     * @return BelongsTo<Contact, $this>
     */
    public function contact(): BelongsTo
    {
        return $this->belongsTo(Contact::class);
    }
}
