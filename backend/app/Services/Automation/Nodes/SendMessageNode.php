<?php

namespace App\Services\Automation\Nodes;

use App\Enums\MessageStatus;
use App\Models\AutomationRun;
use App\Services\Automation\NodeResult;
use App\Services\Messaging\MessageDispatcher;
use App\Services\Messaging\TemplateRenderer;
use App\Services\Platforms\OutboundMessage;

/**
 * Direct message. When the run came from a comment and no messaging window is
 * open, the dispatcher sends it as the comment's single private reply.
 * Optionally waits for the person's reply (which opens the 24h window).
 */
class SendMessageNode implements ResumableNode
{
    use SendsMessages;

    public function __construct(
        private readonly MessageDispatcher $dispatcher,
        private readonly TemplateRenderer $renderer,
    ) {}

    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $contact = $run->contact;
        $variables = $this->variables($run);
        $buttons = array_values(array_filter(
            array_map(fn (array $button): array => [
                'title' => $this->renderer->render((string) ($button['title'] ?? ''), $contact, $variables),
                'url' => trim((string) ($button['url'] ?? '')),
            ], $data['buttons'] ?? []),
            fn (array $button): bool => $button['title'] !== '' && filter_var($button['url'], FILTER_VALIDATE_URL) !== false,
        ));

        $outbound = new OutboundMessage($this->renderer->render((string) ($data['text'] ?? ''), $contact, $variables), $buttons);
        $message = $this->dispatcher->sendDirect($contact->channel, $contact, $outbound, $run->comment, $this->meta($run));
        $run->forceFill(['conversation_id' => $message->conversation_id])->save();

        $label = $message->kind->value === 'private_reply' ? 'Sent private reply' : 'Sent DM';

        if ($message->status === MessageStatus::Sent && ($data['wait_for_reply'] ?? false)) {
            return NodeResult::wait('reply', "{$label}; waiting for a reply", now()->addHours((int) ($data['timeout_hours'] ?? 23)));
        }

        return $this->resultFor($message, "{$label}: \"".mb_strimwidth($outbound->text, 0, 80, '…').'"');
    }

    public function resume(AutomationRun $run, array $data, ?string $input): NodeResult
    {
        return $input === null
            ? NodeResult::next('No reply before timeout', [], 'timeout')
            : NodeResult::next('Contact replied: "'.mb_strimwidth($input, 0, 80, '…').'"', ['reply' => $input]);
    }
}
