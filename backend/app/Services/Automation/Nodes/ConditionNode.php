<?php

namespace App\Services\Automation\Nodes;

use App\Models\AutomationRun;
use App\Models\Contact;
use App\Services\Automation\NodeResult;

/**
 * Branches on contact data. Rule fields: tag, email, phone, custom_field, text, platform.
 * Operators: has, not_has, exists, not_exists, equals, not_equals, contains.
 */
class ConditionNode implements NodeHandler
{
    public function handle(AutomationRun $run, array $data): NodeResult
    {
        $rules = $data['rules'] ?? [];
        $results = array_map(fn (array $rule): bool => $this->evaluate($rule, $run), $rules);
        $passed = $rules === [] || (($data['match'] ?? 'all') === 'any' ? in_array(true, $results, true) : ! in_array(false, $results, true));

        return NodeResult::next($passed ? 'Condition met' : 'Condition not met', ['rules' => count($rules)], $passed ? 'true' : 'false');
    }

    /**
     * @param  array<string, mixed>  $rule
     */
    private function evaluate(array $rule, AutomationRun $run): bool
    {
        $contact = $run->contact;
        $operator = $rule['operator'] ?? 'exists';
        $expected = mb_strtolower(trim((string) ($rule['value'] ?? '')));

        if (($rule['field'] ?? null) === 'tag') {
            $has = $contact->tags()->whereRaw('lower(name) = ?', [$expected])->exists();

            return $operator === 'not_has' ? ! $has : $has;
        }

        $actual = $this->value($rule, $contact, $run);
        $actualLower = mb_strtolower((string) $actual);

        return match ($operator) {
            'exists', 'has' => $actual !== null && $actual !== '',
            'not_exists', 'not_has' => $actual === null || $actual === '',
            'equals' => $actualLower === $expected,
            'not_equals' => $actualLower !== $expected,
            'contains' => $expected !== '' && str_contains($actualLower, $expected),
            default => false,
        };
    }

    /**
     * @param  array<string, mixed>  $rule
     */
    private function value(array $rule, Contact $contact, AutomationRun $run): mixed
    {
        return match ($rule['field'] ?? null) {
            'email' => $contact->email,
            'phone' => $contact->phone,
            'platform' => $contact->platform,
            'custom_field' => data_get($contact->custom_fields, (string) ($rule['key'] ?? '')),
            'text' => $run->context['last_input'] ?? $run->context['trigger']['text'] ?? null,
            default => null,
        };
    }
}
