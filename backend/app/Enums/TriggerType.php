<?php

namespace App\Enums;

enum TriggerType: string
{
    case CommentKeyword = 'comment_keyword';
    case DmKeyword = 'dm_keyword';
    case StoryReply = 'story_reply';
    case AnyDm = 'any_dm';
    case Postback = 'postback';

    public function label(): string
    {
        return match ($this) {
            self::CommentKeyword => 'Comment contains keyword',
            self::DmKeyword => 'Direct message contains keyword',
            self::StoryReply => 'Story reply',
            self::AnyDm => 'Any incoming direct message',
            self::Postback => 'Button clicked',
        };
    }
}
