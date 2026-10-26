<?php

namespace App\Services\OAuth;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

/**
 * One-time OAuth state tokens bound to the workspace and user that started
 * the connection (CSRF protection for the callback).
 */
class OAuthStateStore
{
    public function issue(string $platform, int $workspaceId, int $userId): string
    {
        $state = Str::random(40);
        Cache::put("oauth_state:{$state}", compact('platform', 'workspaceId', 'userId'), now()->addMinutes(15));

        return $state;
    }

    /**
     * @return array{platform: string, workspaceId: int, userId: int}|null
     */
    public function consume(string $platform, ?string $state): ?array
    {
        if (! $state) {
            return null;
        }

        $payload = Cache::pull("oauth_state:{$state}");

        return ($payload['platform'] ?? null) === $platform ? $payload : null;
    }
}
