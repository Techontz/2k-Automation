<?php

namespace App\Enums;

enum MessageKind: string
{
    case Dm = 'dm';
    case Comment = 'comment';
    case CommentReply = 'comment_reply';
    case PrivateReply = 'private_reply';
    case Template = 'template';
    case Note = 'note';
}
