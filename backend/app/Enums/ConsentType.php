<?php

namespace App\Enums;

enum ConsentType: string
{
    case EmailMarketing = 'email_marketing';
    case EmailTransactional = 'email_transactional';
    case Messaging = 'messaging';
}
