<?php

use Illuminate\Support\Facades\Schedule;

Schedule::command('automations:resume-due')->everyMinute()->withoutOverlapping();
Schedule::command('channels:refresh-tokens')->dailyAt('03:00')->withoutOverlapping();
Schedule::command('queue:prune-failed --hours=336')->daily();
