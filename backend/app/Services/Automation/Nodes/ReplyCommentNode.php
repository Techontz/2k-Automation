<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Services\Automation\NodeResult;
use App\Services\Messaging\MessageDispatcher;
use App\Services\Messaging\TemplateRenderer;
use Illuminate\Support\Arr;

/**
 * Public reply under the triggering comment. Multiple variants are rotated
 * at random so replies look natural and avoid duplicate-content spam signals.
 */
class ReplyCommentNode implements NodeHandler
{
    use SendsMessages;

    public function __construct(
        private readonly MessageDispatcher $dispatcher,
        private readonly TemplateRenderer $renderer,
    ) {}

    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $comment = $run->comment;

        if (! $comment) {
            return NodeResult::blocked('Skipped: this run was not started by a comment.');
        }

        $replies = array_values(array_filter($data['replies'] ?? [], fn ($reply): bool => trim((string) $reply) !== ''));

        if ($replies === []) {
            return NodeResult::failed('No reply text configured.');
        }

        $text = $this->renderer->render(Arr::random($replies), $run->contact, $this->variables($run));
        $message = $this->dispatcher->replyToComment($comment, $text, $this->meta($run));

        return $this->resultFor($message, "Replied publicly: \"{$text}\"");
    }
}
