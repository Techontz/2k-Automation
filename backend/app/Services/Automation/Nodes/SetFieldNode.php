<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Services\Automation\NodeResult;
use App\Services\Messaging\TemplateRenderer;

class SetFieldNode implements NodeHandler
{
    public function __construct(private readonly TemplateRenderer $renderer) {}

    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $key = preg_replace('/[^a-z0-9_]/', '_', mb_strtolower(trim((string) ($data['key'] ?? ''))));

        if ($key === '') {
            return NodeResult::failed('No field name configured.');
        }

        $contact = $run->contact;
        $value = $this->renderer->render((string) ($data['value'] ?? ''), $contact, ['last_input' => $run->context['last_input'] ?? '']);
        $contact->forceFill(['custom_fields' => [...($contact->custom_fields ?? []), $key => $value]])->save();

        return NodeResult::next("Set {$key} = \"{$value}\"");
    }
}
