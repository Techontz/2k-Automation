<?php

namespace App\Console\Commands;

use App\Enums\Platform;
use App\Models\Channel;
use App\Services\Platforms\MetaGraphApi;
use App\Services\Platforms\PlatformException;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('channels:refresh-tokens')]
#[Description('Refresh long-lived Instagram tokens before they expire and flag expired channels')]
class RefreshChannelTokens extends Command
{
    public function handle(): int
    {
        Channel::query()
            ->where('is_simulated', false)
            ->where('status', 'connected')
            ->whereNotNull('token_expires_at')
            ->where('token_expires_at', '<=', now()->addDays(10))
            ->each(function (Channel $channel): void {
                if ($channel->token_expires_at->isPast()) {
                    $channel->forceFill(['status' => 'expired', 'status_reason' => 'Access token expired. Reconnect the account.'])->save();

                    return;
                }

                if ($channel->platform !== Platform::Instagram) {
                    return;
                }

                try {
                    $response = MetaGraphApi::instagram()->get('refresh_access_token', $channel->access_token, ['grant_type' => 'ig_refresh_token']);
                    $channel->forceFill([
                        'access_token' => $response['access_token'],
                        'token_expires_at' => now()->addSeconds((int) ($response['expires_in'] ?? 5184000)),
                    ])->save();
                    $this->line("Refreshed token for channel #{$channel->id}");
                } catch (PlatformException $exception) {
                    $this->warn("Channel #{$channel->id}: {$exception->getMessage()}");
                }
            });

        return self::SUCCESS;
    }
}
