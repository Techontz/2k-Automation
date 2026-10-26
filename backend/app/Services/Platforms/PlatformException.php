<?php

namespace App\Services\Platforms;

use RuntimeException;

/**
 * Normalised platform API failure. The category drives retry behaviour:
 * rate_limited and transient errors are retried with backoff, the rest are not.
 */
class PlatformException extends RuntimeException
{
    public const RateLimited = 'rate_limited';

    public const Transient = 'transient';

    public const Auth = 'auth';

    public const Policy = 'policy';

    public const Invalid = 'invalid';

    public const Unsupported = 'unsupported';

    public function __construct(
        string $message,
        public readonly string $category,
        public readonly ?string $platformCode = null,
        public readonly int $retryAfterSeconds = 60,
    ) {
        parent::__construct($message);
    }

    public static function unsupported(string $message): self
    {
        return new self($message, self::Unsupported);
    }

    public function isRetryable(): bool
    {
        return in_array($this->category, [self::RateLimited, self::Transient], true);
    }
}
