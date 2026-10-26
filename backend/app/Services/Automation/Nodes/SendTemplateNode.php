<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Services\Automation\NodeResult;
use App\Services\Messaging\MessageDispatcher;
use App\Services\Messaging\TemplateRenderer;

/**
 * Pre-approved WhatsApp template — the only way to message outside the 24h window.
 */
class SendTemplateNode implements NodeHandler
{
    use SendsMessages;

    public function __construct(
        private readonly MessageDispatcher $dispatcher,
        private readonly TemplateRenderer $renderer,
    ) {}

    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $contact = $run->contact;
        $parameters = array_map(fn ($value): string => $this->renderer->render((string) $value, $contact, $this->variables($run)), $data['parameters'] ?? []);
        $message = $this->dispatcher->sendTemplate($contact->channel, $contact, (string) $data['template'], (string) ($data['language'] ?? 'en'), $parameters, $this->meta($run));

        return $this->resultFor($message, "Sent template \"{$data['template']}\"");
    }
}
