<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Services\Ai\AiResponder;
use App\Services\Automation\NodeResult;
use App\Services\Messaging\ConversationService;
use App\Services\Messaging\MessageDispatcher;
use App\Services\Platforms\OutboundMessage;

/**
 * Generates a reply with the workspace AI assistant. Low confidence or a
 * handover request routes to the "handover" branch instead of sending.
 */
class AiReplyNode implements NodeHandler
{
    use SendsMessages;

    public function __construct(
        private readonly AiResponder $ai,
        private readonly MessageDispatcher $dispatcher,
        private readonly ConversationService $conversations,
    ) {}

    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $contact = $run->contact;
        $question = (string) ($run->context['last_input'] ?? $run->context['trigger']['text'] ?? '');
        $conversation = $this->conversations->forContact($contact->channel, $contact);
        $reply = $this->ai->respond($run->workspace, $conversation, $question, (string) ($data['instructions'] ?? ''));
        $output = ['confidence' => $reply->confidence, 'language' => $reply->language, 'provider' => $reply->provider];

        if ($reply->shouldHandover) {
            $conversation->forceFill(['needs_human' => true, 'ai_paused' => true])->save();

            return NodeResult::next('AI handed over: '.$reply->handoverReason, $output, 'handover');
        }

        $message = $this->dispatcher->sendDirect($contact->channel, $contact, new OutboundMessage($reply->text), $run->comment, ['source' => 'ai', 'automation_run_id' => $run->id]);

        return $this->resultFor($message, 'AI replied ('.round($reply->confidence * 100).'% confident)');
    }
}
