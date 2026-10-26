<?php

namespace App\Services\Messaging;

use App\Models\Contact;

/**
 * Replaces {{variables}} in message text. Unknown variables render empty.
 */
class TemplateRenderer
{
    /**
     * @param  array<string, mixed>  $extra
     */
    public function render(string $text, ?Contact $contact, array $extra = []): string
    {
        $name = $contact?->name ?: $contact?->username ?: '';
        $variables = [
            'first_name' => $name !== '' ? explode(' ', $name)[0] : 'there',
            'name' => $name,
            'username' => $contact?->username ?? '',
            'email' => $contact?->email ?? '',
            ...$extra,
        ];

        return preg_replace_callback('/\{\{\s*([\w.]+)\s*\}\}/', function (array $match) use ($variables, $contact): string {
            $key = $match[1];

            if (str_starts_with($key, 'custom.')) {
                return (string) data_get($contact?->custom_fields, substr($key, 7), '');
            }

            return (string) ($variables[$key] ?? '');
        }, $text) ?? $text;
    }
}
