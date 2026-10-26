<?php

namespace Database\Seeders;

use App\Models\Automation;
use App\Models\EmailTemplate;
use App\Models\KnowledgeItem;
use App\Models\User;
use App\Services\Automation\FlowTemplates;
use App\Services\Simulator;
use App\Services\WorkspaceService;
use Illuminate\Database\Seeder;

/**
 * Demo workspace: demo@2k.test / demo-pass-123, with automations, AI
 * knowledge and simulated traffic so every screen has something to show.
 */
class DatabaseSeeder extends Seeder
{
    public function run(WorkspaceService $workspaces, Simulator $simulator): void
    {
        $user = User::firstOrCreate(['email' => 'demo@2k.test'], ['name' => 'Demo Creator', 'password' => 'demo-pass-123']);
        $workspace = $user->workspaces()->first() ?? $workspaces->create($user, '2K Demo Studio');
        $workspace->forceFill(['onboarded_at' => now()])->save();

        foreach (['comment_to_dm', 'lead_magnet', 'dm_keyword_price', 'story_reply_ai'] as $index => $key) {
            $template = FlowTemplates::find($key);
            Automation::firstOrCreate(['workspace_id' => $workspace->id, 'name' => $template['name']], [
                'created_by' => $user->id,
                'description' => $template['description'],
                'status' => $index < 3 ? 'active' : 'draft',
                'trigger_type' => $template['trigger_type'],
                'trigger_config' => $template['trigger_config'],
                'flow' => $template['flow'],
                'priority' => 100 + $index,
            ]);
        }

        foreach ([
            ['Delivery', 'We deliver across Dar es Salaam within 24 hours. Upcountry delivery takes 2–4 days.'],
            ['Opening hours', 'Our team replies Monday to Saturday, 9am to 6pm East Africa Time.'],
            ['Claude prompt guide', 'The free Claude prompt guide is sent by DM when you comment CLAUDE on our Reel.'],
        ] as [$title, $content]) {
            KnowledgeItem::firstOrCreate(['workspace_id' => $workspace->id, 'title' => $title], ['content' => $content]);
        }

        EmailTemplate::firstOrCreate(['workspace_id' => $workspace->id, 'name' => 'Free guide delivery'], [
            'subject' => 'Your free guide, {{first_name}}',
            'body_html' => '<h2>Here is your guide 🎉</h2><p>Hi {{first_name}}, thanks for asking! <a href="https://example.com/guide">Download the guide</a>.</p>',
            'category' => 'transactional',
        ]);

        $simulator->comment($workspace, null, 'amina.k', 'LINK please 🔥');
        $simulator->comment($workspace, null, 'juma_tz', 'Can I get the link?');
        $simulator->comment($workspace, null, 'neema.designs', 'GUIDE');
        $simulator->message($workspace, 'neema.designs', 'neema@example.com');
        $simulator->message($workspace, 'baraka', 'Bei gani? price please');
        $simulator->comment($workspace, null, 'fan_account', 'Love this Reel 😍');
    }
}
