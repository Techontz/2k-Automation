<?php

namespace App\Services\Automation\Nodes;

use App\Enums\ConsentType;
use App\Enums\MessageStatus;
use App\Models\AutomationRun;
use App\Services\Automation\NodeResult;
use App\Services\Contacts\ConsentService;
use App\Services\Messaging\MessageDispatcher;
use App\Services\Messaging\TemplateRenderer;
use App\Services\Platforms\OutboundMessage;

/**
 * Asks for an email address in the conversation and records consent for the
 * purpose stated in the prompt. Marketing consent is only recorded when the
 * node is configured to ask for it explicitly.
 */
class CollectEmailNode implements ResumableNode
{
    use SendsMessages;

    public function __construct(
        private readonly MessageDispatcher $dispatcher,
        private readonly TemplateRenderer $renderer,
        private readonly ConsentService $consents,
    ) {}

    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $prompt = (string) ($data['prompt'] ?? 'What email should we send it to?');

        return $this->ask($run, $prompt, $data);
    }

    public function resume(AutomationRun $run, array $data, ?string $input): NodeResult
    {
        if ($input === null) {
            return NodeResult::next('No email received before timeout', [], 'invalid');
        }

        preg_match('/[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}/i', $input, $match);
        $email = isset($match[0]) ? mb_strtolower($match[0]) : null;

        if ($email === null || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            $attempts = (int) ($run->context['vars']['email_attempts'] ?? 0) + 1;
            $this->setVar($run, 'email_attempts', $attempts);

            if ($attempts >= (int) ($data['max_attempts'] ?? 2)) {
                return NodeResult::next('No valid email after '.$attempts.' attempts', [], 'invalid');
            }

            return $this->ask($run, (string) ($data['retry_prompt'] ?? 'Hmm, that does not look like an email address. Could you double-check it?'), $data);
        }

        $contact = $run->contact;
        $contact->forceFill(['email' => $email])->save();
        $evidence = 'Provided in '.$contact->platform.' conversation in response to: "'.($data['prompt'] ?? '').'"';
        $this->consents->grant($contact, ConsentType::EmailTransactional, 'automation', $evidence);

        if ($data['marketing_opt_in'] ?? false) {
            $this->consents->grant($contact, ConsentType::EmailMarketing, 'automation', $evidence);
        }

        $this->setVar($run, 'email', $email);

        return NodeResult::next("Collected email {$email}", ['email' => $email]);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function ask(AutomationRun $run, string $prompt, array $data): NodeResult
    {
        $text = $this->renderer->render($prompt, $run->contact, $this->variables($run));
        $message = $this->dispatcher->sendDirect($run->contact->channel, $run->contact, new OutboundMessage($text), $run->comment, $this->meta($run));

        if ($message->status !== MessageStatus::Sent) {
            return $this->resultFor($message, '', 'invalid');
        }

        return NodeResult::wait('email', 'Asked for email; waiting for reply', now()->addHours((int) ($data['timeout_hours'] ?? 23)));
    }

    private function setVar(AutomationRun $run, string $key, mixed $value): void
    {
        $context = $run->context;
        $context['vars'][$key] = $value;
        $run->forceFill(['context' => $context])->save();
    }
}
