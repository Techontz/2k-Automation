<?php

namespace App\Enums;

enum WorkspaceRole: string
{
    case Owner = 'owner';
    case Admin = 'admin';
    case Editor = 'editor';
    case Agent = 'agent';
    case Viewer = 'viewer';

    /**
     * Abilities granted to each role. Higher roles inherit everything below them.
     *
     * @return list<string>
     */
    public function abilities(): array
    {
        $viewer = ['view'];
        $agent = [...$viewer, 'inbox.reply', 'contacts.edit'];
        $editor = [...$agent, 'automations.manage', 'email.manage', 'ai.manage', 'simulate'];
        $admin = [...$editor, 'channels.manage', 'team.manage', 'settings.manage'];

        return match ($this) {
            self::Owner => [...$admin, 'workspace.delete', 'billing.manage'],
            self::Admin => $admin,
            self::Editor => $editor,
            self::Agent => $agent,
            self::Viewer => $viewer,
        };
    }

    public function allows(string $ability): bool
    {
        return in_array($ability, $this->abilities(), true);
    }
}
