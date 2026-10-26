<?php

namespace App\Services\Platforms;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;

/**
 * Thin Graph API transport shared by Instagram, Messenger and WhatsApp clients.
 * Maps Graph error codes onto PlatformException categories.
 */
class MetaGraphApi
{
    /** @var list<int> */
    private const RateLimitCodes = [4, 17, 32, 613, 80001, 80002, 80004, 80005, 80006, 80008, 80014, 130429, 131048, 131056];

    /** @var list<int> */
    private const PolicyCodes = [10, 200, 230, 551, 1545041, 2018108, 2018278, 2534022, 131047, 131026, 131051];

    public function __construct(private readonly string $baseUrl) {}

    public static function facebook(): self
    {
        return new self('https://graph.facebook.com/'.config('services.meta.graph_version'));
    }

    public static function instagram(): self
    {
        return new self('https://graph.instagram.com/'.config('services.meta.graph_version'));
    }

    /**
     * @param  array<string, mixed>  $query
     * @return array<string, mixed>
     */
    public function get(string $path, string $token, array $query = []): array
    {
        return $this->send('get', $path, $token, $query);
    }

    /**
     * @param  array<string, mixed>  $body
     * @return array<string, mixed>
     */
    public function post(string $path, string $token, array $body = []): array
    {
        return $this->send('post', $path, $token, $body);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function send(string $method, string $path, string $token, array $data): array
    {
        try {
            $response = Http::withToken($token)
                ->acceptJson()
                ->timeout(15)
                ->retry(2, 500, fn ($exception): bool => $exception instanceof ConnectionException, throw: false)
                ->{$method}($this->baseUrl.'/'.ltrim($path, '/'), $data);
        } catch (ConnectionException $exception) {
            throw new PlatformException('Could not reach the platform API: '.$exception->getMessage(), PlatformException::Transient);
        }

        if ($response->successful()) {
            return $response->json() ?? [];
        }

        throw $this->toException($response);
    }

    private function toException(Response $response): PlatformException
    {
        $error = $response->json('error') ?? [];
        $code = (int) ($error['code'] ?? 0);
        $subcode = (int) ($error['error_subcode'] ?? 0);
        $message = $error['error_user_msg'] ?? $error['message'] ?? 'Platform API error (HTTP '.$response->status().')';
        $platformCode = $code.($subcode ? ':'.$subcode : '');

        $category = match (true) {
            $response->status() === 429, in_array($code, self::RateLimitCodes, true) => PlatformException::RateLimited,
            $code === 190, $code === 102, $response->status() === 401 => PlatformException::Auth,
            in_array($code, self::PolicyCodes, true), in_array($subcode, self::PolicyCodes, true) => PlatformException::Policy,
            $response->serverError(), in_array($code, [1, 2], true) => PlatformException::Transient,
            default => PlatformException::Invalid,
        };

        $retryAfter = (int) ($response->header('Retry-After') ?: ($category === PlatformException::RateLimited ? 300 : 30));

        return new PlatformException($message, $category, $platformCode, $retryAfter);
    }
}
