<?php

namespace App\Enums;

enum Platform: string
{
    case Instagram = 'instagram';
    case Facebook = 'facebook';
    case WhatsApp = 'whatsapp';
    case TikTok = 'tiktok';
    case Email = 'email';

    public function label(): string
    {
        return match ($this) {
            self::Instagram => 'Instagram',
            self::Facebook => 'Facebook Messenger',
            self::WhatsApp => 'WhatsApp Business',
            self::TikTok => 'TikTok',
            self::Email => 'Email',
        };
    }

    /**
     * Capabilities officially exposed by each platform's API for business accounts.
     *
     * @return array{comment_reply: bool, private_reply: bool, dm: bool, templates: bool}
     */
    public function capabilities(): array
    {
        return match ($this) {
            self::Instagram, self::Facebook => ['comment_reply' => true, 'private_reply' => true, 'dm' => true, 'templates' => false],
            self::WhatsApp => ['comment_reply' => false, 'private_reply' => false, 'dm' => true, 'templates' => true],
            self::TikTok => ['comment_reply' => true, 'private_reply' => false, 'dm' => false, 'templates' => false],
            self::Email => ['comment_reply' => false, 'private_reply' => false, 'dm' => false, 'templates' => true],
        };
    }
}
