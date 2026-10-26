<?php

namespace App\Services\Webhooks;

use Illuminate\Support\Carbon;

/**
 * Platform-neutral representation of one inbound webhook event.
 */
final readonly class InboundEvent
{
    public const Comment = 'comment';

    public const Message = 'message';

    public const Postback = 'postback';

    public const Status = 'status';

    /**
     * @param  array<string, mixed>  $extra
     */
    public function __construct(
        public string $platform,
        public string $type,
        public string $accountId,
        public string $externalId,
        public ?string $senderId = null,
        public ?string $senderUsername = null,
        public ?string $senderName = null,
        public ?string $text = null,
        public ?string $mediaId = null,
        public ?string $mediaType = null,
        public ?string $parentId = null,
        public bool $isEcho = false,
        public bool $isStoryReply = false,
        public ?string $postbackPayload = null,
        public ?Carbon $occurredAt = null,
        public array $extra = [],
    ) {}

    public function dedupeKey(): string
    {
        return mb_substr("{$this->platform}:{$this->type}:{$this->accountId}:{$this->externalId}", 0, 191);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [...get_object_vars($this), 'occurredAt' => $this->occurredAt?->toIso8601String()];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function fromArray(array $data): self
    {
        $data['occurredAt'] = isset($data['occurredAt']) ? Carbon::parse($data['occurredAt']) : null;

        return new self(...$data);
    }
}
