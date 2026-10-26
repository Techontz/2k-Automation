<?php

namespace Database\Factories;

use App\Models\Automation;
use App\Models\Workspace;
use App\Services\Automation\FlowTemplates;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Automation>
 */
class AutomationFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $template = FlowTemplates::find('comment_to_dm');

        return [
            'workspace_id' => Workspace::factory(),
            'name' => $template['name'],
            'status' => 'active',
            'trigger_type' => $template['trigger_type'],
            'trigger_config' => $template['trigger_config'],
            'flow' => $template['flow'],
        ];
    }

    public function fromTemplate(string $key): static
    {
        $template = FlowTemplates::find($key);

        return $this->state(fn (): array => [
            'name' => $template['name'],
            'trigger_type' => $template['trigger_type'],
            'trigger_config' => $template['trigger_config'],
            'flow' => $template['flow'],
        ]);
    }
}
