<?php

namespace App\Services\Contacts;

use App\Enums\ConsentType;
use App\Models\Consent;
use App\Models\Contact;

/**
 * Append-only consent ledger: every change is a new row with its evidence.
 */
class ConsentService
{
    public function grant(Contact $contact, ConsentType $type, string $source, ?string $evidence = null, ?string $ip = null): Consent
    {
        return $this->record($contact, $type, 'granted', $source, $evidence, $ip);
    }

    public function revoke(Contact $contact, ConsentType $type, string $source, ?string $evidence = null, ?string $ip = null): Consent
    {
        return $this->record($contact, $type, 'revoked', $source, $evidence, $ip);
    }

    private function record(Contact $contact, ConsentType $type, string $status, string $source, ?string $evidence, ?string $ip): Consent
    {
        return Consent::create([
            'workspace_id' => $contact->workspace_id,
            'contact_id' => $contact->id,
            'type' => $type,
            'status' => $status,
            'source' => $source,
            'evidence' => $evidence,
            'ip_address' => $ip,
            'recorded_at' => now(),
        ]);
    }
}
