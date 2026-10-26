<?php

namespace App\Jobs;

use App\Enums\ConsentType;
use App\Models\Contact;
use App\Models\EmailCampaign;
use App\Models\EmailSend;
use App\Services\Email\EmailService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Sends a campaign to every contact in its audience who has an email and
 * marketing consent. Idempotent: contacts already processed are skipped.
 */
class SendEmailCampaign implements ShouldQueue
{
    use Queueable;

    public int $timeout = 3600;

    public function __construct(public int $campaignId) {}

    public function handle(EmailService $email): void
    {
        $campaign = EmailCampaign::with(['template', 'provider'])->find($this->campaignId);

        if (! $campaign || ! in_array($campaign->status, ['scheduled', 'sending'], true)) {
            return;
        }

        $campaign->forceFill(['status' => 'sending'])->save();
        $query = self::audienceQuery($campaign);
        $campaign->forceFill(['recipients_count' => (clone $query)->count()])->save();

        $query->chunkById(200, function ($contacts) use ($campaign, $email): void {
            foreach ($contacts as $contact) {
                if (EmailSend::where('email_campaign_id', $campaign->id)->where('contact_id', $contact->id)->exists()) {
                    continue;
                }

                $send = $email->sendToContact($contact, $campaign->template, ['campaign_id' => $campaign->id, 'provider' => $campaign->provider]);
                $campaign->increment(match ($send->status) {
                    'sent' => 'sent_count',
                    'skipped' => 'skipped_count',
                    default => 'failed_count',
                });
            }
        });

        $campaign->forceFill(['status' => 'sent', 'sent_at' => now()])->save();
    }

    /**
     * @return Builder<Contact>
     */
    public static function audienceQuery(EmailCampaign $campaign): Builder
    {
        $tagIds = $campaign->audience['tag_ids'] ?? [];

        return Contact::forWorkspace($campaign->workspace_id)
            ->whereNotNull('email')
            ->where('unsubscribed', false)
            ->where('is_simulated', false)
            ->when($tagIds !== [], fn ($query) => $query->whereHas('tags', fn ($tags) => $tags->whereIn('tags.id', $tagIds)))
            ->whereHas('consents', function ($consents): void {
                $consents->where('type', ConsentType::EmailMarketing->value)
                    ->where('status', 'granted')
                    ->whereRaw('consents.id = (select max(c2.id) from consents c2 where c2.contact_id = consents.contact_id and c2.type = consents.type)');
            });
    }
}
