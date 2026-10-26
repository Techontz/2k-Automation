<?php

namespace App\Services\Webhooks;

class SignatureVerifier
{
    /**
     * Meta signs the raw request body with HMAC-SHA256 using the app secret
     * (X-Hub-Signature-256: sha256=<hex>). Instagram Login apps use the
     * Instagram app secret, so both configured secrets are accepted.
     */
    public function verifyMeta(string $payload, ?string $header): bool
    {
        if (! $header || ! str_starts_with($header, 'sha256=')) {
            return false;
        }

        $signature = substr($header, 7);
        $secrets = array_filter([config('services.meta.app_secret'), config('services.instagram.app_secret')]);

        foreach ($secrets as $secret) {
            if (hash_equals(hash_hmac('sha256', $payload, $secret), $signature)) {
                return true;
            }
        }

        return false;
    }

    /**
     * TikTok-Signature: t=<timestamp>,s=<hex hmac of "{t}.{body}">. Rejects
     * signatures older than five minutes to prevent replay.
     */
    public function verifyTikTok(string $payload, ?string $header): bool
    {
        $secret = config('services.tiktok.app_secret');

        if (! $header || ! $secret) {
            return false;
        }

        parse_str(str_replace(',', '&', $header), $parts);
        $timestamp = (int) ($parts['t'] ?? 0);
        $signature = (string) ($parts['s'] ?? '');

        if ($timestamp === 0 || abs(time() - $timestamp) > 300) {
            return false;
        }

        return hash_equals(hash_hmac('sha256', "{$timestamp}.{$payload}", $secret), $signature);
    }
}
