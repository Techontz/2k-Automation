<?php

namespace App\Enums;

enum AutomationStatus: string
{
    case Draft = 'draft';
    case Active = 'active';
    case Paused = 'paused';
}
