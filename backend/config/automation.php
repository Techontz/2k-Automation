<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Platform messaging policy windows (hours)
    |--------------------------------------------------------------------------
    |
    | Standard messaging is only permitted within these windows after the
    | contact's last inbound message. Private replies to comments are only
    | permitted within the comment window, once per comment.
    |
    */

    'windows' => [
        'standard_hours' => 24,
        'human_agent_hours' => 168,
        'private_reply_hours' => 168,
    ],

    /*
    | Proactive per-account limits, kept just under the documented platform caps.
    */
    'limits' => [
        'private_replies_per_hour' => (int) env('LIMIT_PRIVATE_REPLIES_PER_HOUR', 740),
    ],

    /*
    | Hard ceiling on nodes executed per run step, protecting against loops.
    */
    'max_steps_per_run' => 50,

    /*
    | Default queue names. Webhooks are processed ahead of bulk email.
    */
    'queues' => [
        'webhooks' => env('QUEUE_WEBHOOKS', 'webhooks'),
        'automations' => env('QUEUE_AUTOMATIONS', 'automations'),
        'email' => env('QUEUE_EMAIL', 'email'),
    ],

    /*
    | Run simulated events inline (no worker needed) so the simulator shows
    | results immediately. Delays still wait for the scheduler or fast-forward.
    */
    'simulator_sync' => env('SIMULATOR_SYNC', true),

    /*
    | URL of the Next.js app, used for OAuth redirects back to the dashboard.
    */
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),

];
