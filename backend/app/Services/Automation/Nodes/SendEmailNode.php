<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Models\EmailTemplate;
use App\Services\Automation\NodeResult;
use App\Services\Email\EmailService;

class SendEmailNode implements NodeHandler
{
    public function __construct(private readonly EmailService $email) {}

    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $template = EmailTemplate::forWorkspace($run->workspace_id)->find($data['template_id'] ?? null);

        if (! $template) {
            return NodeResult::failed('Email template not found.');
        }

        $send = $this->email->sendToContact($run->contact, $template, ['automation_run_id' => $run->id, 'simulated' => $run->is_simulated]);

        return match ($send->status) {
            'sent' => NodeResult::next("Emailed \"{$template->subject}\" to {$send->to_email}", ['email_send_id' => $send->id]),
            'skipped' => NodeResult::blocked('Email not sent: '.$send->error, ['email_send_id' => $send->id]),
            default => NodeResult::failed('Email failed: '.$send->error, ['email_send_id' => $send->id]),
        };
    }
}
