<?php

namespace App\Services\Email;

use App\Enums\ConsentType;
use App\Models\Contact;
use App\Models\EmailProvider;
use App\Models\EmailSend;
use App\Models\EmailTemplate;
use App\Services\Messaging\TemplateRenderer;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\URL;
use Throwable;

/**
 * Sends template emails only to contacts with matching consent, always with an
 * unsubscribe link. Workspace SMTP providers are configured per send.
 */
class EmailService
{
    public function __construct(private readonly TemplateRenderer $renderer) {}

    /**
     * @param  array{automation_run_id?: int|null, campaign_id?: int|null, provider?: EmailProvider|null, simulated?: bool}  $options
     */
    public function sendToContact(Contact $contact, EmailTemplate $template, array $options = []): EmailSend
    {
        $send = new EmailSend([
            'workspace_id' => $contact->workspace_id,
            'email_campaign_id' => $options['campaign_id'] ?? null,
            'email_template_id' => $template->id,
            'contact_id' => $contact->id,
            'automation_run_id' => $options['automation_run_id'] ?? null,
            'to_email' => (string) $contact->email,
            'subject' => $this->renderer->render($template->subject, $contact),
            'status' => 'queued',
        ]);

        if ($skipReason = $this->skipReason($contact, $template)) {
            $send->fill(['status' => 'skipped', 'error' => $skipReason])->save();

            return $send;
        }

        $html = $this->renderer->render($template->body_html, $contact).$this->footer($contact);

        if ($options['simulated'] ?? $contact->is_simulated) {
            $send->fill(['status' => 'sent', 'sent_at' => now(), 'error' => 'Simulated — no email left the server.'])->save();

            return $send;
        }

        $provider = $options['provider'] ?? EmailProvider::forWorkspace($contact->workspace_id)->where('is_default', true)->first();

        try {
            $mailer = $this->mailerFor($provider);
            Mail::mailer($mailer)->html($html, function ($message) use ($send, $provider): void {
                $message->to($send->to_email)->subject($send->subject);

                if ($provider) {
                    $message->from($provider->from_email, $provider->from_name);
                }
            });
            $send->fill(['status' => 'sent', 'sent_at' => now()]);
        } catch (Throwable $exception) {
            report($exception);
            $send->fill(['status' => 'failed', 'error' => mb_strimwidth($exception->getMessage(), 0, 500, '…')]);
        }

        $send->save();

        return $send;
    }

    public function skipReason(Contact $contact, EmailTemplate $template): ?string
    {
        if (! $contact->email) {
            return 'Contact has no email address.';
        }

        if ($contact->unsubscribed) {
            return 'Contact unsubscribed.';
        }

        $hasMarketing = $contact->hasConsent(ConsentType::EmailMarketing);

        if ($template->category === 'marketing' && ! $hasMarketing) {
            return 'No marketing email consent on record.';
        }

        if (! $hasMarketing && ! $contact->hasConsent(ConsentType::EmailTransactional)) {
            return 'No email consent on record.';
        }

        return null;
    }

    private function mailerFor(?EmailProvider $provider): string
    {
        if (! $provider || $provider->driver === 'log') {
            return $provider ? 'log' : config('mail.default');
        }

        $name = "workspace_provider_{$provider->id}";
        $credentials = $provider->credentials ?? [];

        config(["mail.mailers.{$name}" => [
            'transport' => 'smtp',
            'host' => $credentials['host'] ?? '',
            'port' => (int) ($credentials['port'] ?? 587),
            'username' => $credentials['username'] ?? null,
            'password' => $credentials['password'] ?? null,
            'encryption' => $credentials['encryption'] ?? 'tls',
            'timeout' => 20,
        ]]);

        return $name;
    }

    private function footer(Contact $contact): string
    {
        $url = URL::signedRoute('v1.email.unsubscribe', ['contact' => $contact->id]);

        return '<p style="margin-top:32px;font-size:12px;color:#888">You received this email because you shared your address with us. '
            .'<a href="'.e($url).'">Unsubscribe</a></p>';
    }
}
