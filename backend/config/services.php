<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | Social platforms (official APIs only)
    |--------------------------------------------------------------------------
    */

    'meta' => [
        'graph_version' => env('META_GRAPH_VERSION', 'v26.0'),
        'app_id' => env('META_APP_ID'),
        'app_secret' => env('META_APP_SECRET'),
        'webhook_verify_token' => env('META_WEBHOOK_VERIFY_TOKEN'),
        'messenger_scopes' => ['pages_show_list', 'pages_messaging', 'pages_manage_metadata', 'pages_read_engagement', 'pages_manage_engagement', 'business_management'],
    ],

    'instagram' => [
        'app_id' => env('INSTAGRAM_APP_ID'),
        'app_secret' => env('INSTAGRAM_APP_SECRET'),
        'scopes' => ['instagram_business_basic', 'instagram_business_manage_messages', 'instagram_business_manage_comments'],
    ],

    'whatsapp' => [
        'embedded_signup_config_id' => env('WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID'),
        'scopes' => ['whatsapp_business_management', 'whatsapp_business_messaging'],
    ],

    'tiktok' => [
        'app_id' => env('TIKTOK_APP_ID'),
        'app_secret' => env('TIKTOK_APP_SECRET'),
        'api_base' => env('TIKTOK_API_BASE', 'https://business-api.tiktok.com/open_api/v1.3'),
        'scopes' => ['user.info.basic', 'video.list', 'comment.list', 'comment.list.manage'],
    ],

    /*
    |--------------------------------------------------------------------------
    | AI providers (workspace keys override these)
    |--------------------------------------------------------------------------
    */

    'anthropic' => [
        'key' => env('ANTHROPIC_API_KEY'),
        'model' => env('ANTHROPIC_MODEL', 'claude-opus-5-5'),
    ],

    'openai' => [
        'key' => env('OPENAI_API_KEY'),
        'model' => env('OPENAI_MODEL', 'gpt-5-mini'),
    ],

];
