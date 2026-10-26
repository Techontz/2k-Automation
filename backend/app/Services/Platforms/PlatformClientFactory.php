<?php

namespace App\Services\Platforms;

use App\Enums\Platform;
use App\Models\Channel;

class PlatformClientFactory
{
    public function for(Channel $channel): PlatformClient
    {
        if ($channel->is_simulated) {
            return app(SimulatedClient::class);
        }

        return match ($channel->platform) {
            Platform::Instagram => new InstagramClient(MetaGraphApi::instagram()),
            Platform::Facebook => new FacebookClient(MetaGraphApi::facebook()),
            Platform::WhatsApp => new WhatsAppClient(MetaGraphApi::facebook()),
            Platform::TikTok => app(TikTokClient::class),
            Platform::Email => throw PlatformException::unsupported('Email is sent through the email module.'),
        };
    }
}
