<?php

namespace App\Services\Platforms;

/**
 * Platform-neutral outbound message. Clients degrade gracefully when a
 * platform cannot render buttons (they are appended as plain links).
 */
final readonly class OutboundMessage
{
    /**
     * @param  list<array{title: string, url: string}>  $buttons
     */
    public function __construct(
        public string $text,
        public array $buttons = [],
        public ?string $imageUrl = null,
    ) {}

    public function textWithLinks(): string
    {
        if ($this->buttons === []) {
            return $this->text;
        }

        $links = array_map(fn (array $button): string => "{$button['title']}: {$button['url']}", $this->buttons);

        return trim($this->text."\n\n".implode("\n", $links));
    }

    /**
     * @return array{text: string, buttons: list<array{title: string, url: string}>, image_url: string|null}
     */
    public function toArray(): array
    {
        return ['text' => $this->text, 'buttons' => $this->buttons, 'image_url' => $this->imageUrl];
    }
}
