<?php

namespace App\Services\Automation;

/**
 * Ready-made automation blueprints shown in the "New automation" gallery.
 */
class FlowTemplates
{
    /**
     * @return list<array{key: string, name: string, description: string, trigger_type: string, trigger_config: array<string, mixed>, flow: array<string, mixed>}>
     */
    public static function all(): array
    {
        return [
            self::commentToDm(),
            self::leadMagnet(),
            self::storyReplyAi(),
            self::faqAssistant(),
            self::blank(),
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    public static function find(string $key): ?array
    {
        return collect(self::all())->firstWhere('key', $key);
    }

    /**
     * @return array<string, mixed>
     */
    private static function commentToDm(): array
    {
        return [
            'key' => 'comment_to_dm',
            'name' => 'Comment keyword → DM a link',
            'description' => 'Someone comments a keyword on your Reel; reply publicly and send the link in a private reply.',
            'trigger_type' => 'comment_keyword',
            'trigger_config' => ['keywords' => ['LINK'], 'match' => 'contains', 'post_ids' => [], 'skip_replies' => true],
            'flow' => [
                'nodes' => [
                    self::node('trigger', 'trigger', 0, ['label' => 'Comment contains keyword']),
                    self::node('reply', 'reply_comment', 1, ['label' => 'Public reply', 'replies' => ['Check your DMs {{first_name}}! 📩', 'Sent it to your inbox 🙌', 'Just DMed you!']]),
                    self::node('dm', 'send_message', 2, ['label' => 'Send the link', 'text' => "Hey {{first_name}}! Here's what you asked for 👇", 'buttons' => [['title' => 'Open the guide', 'url' => 'https://example.com/guide']], 'wait_for_reply' => false]),
                    self::node('tag', 'add_tag', 3, ['label' => 'Tag lead', 'tag' => 'reel-lead']),
                ],
                'edges' => [self::edge('trigger', 'reply'), self::edge('reply', 'dm'), self::edge('dm', 'tag')],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function leadMagnet(): array
    {
        return [
            'key' => 'lead_magnet',
            'name' => 'Lead magnet with email capture',
            'description' => 'Comment keyword → private reply asking for their email → validate, record consent, send the guide by email.',
            'trigger_type' => 'comment_keyword',
            'trigger_config' => ['keywords' => ['GUIDE'], 'match' => 'contains', 'post_ids' => [], 'skip_replies' => true],
            'flow' => [
                'nodes' => [
                    self::node('trigger', 'trigger', 0, ['label' => 'Comment contains keyword']),
                    self::node('reply', 'reply_comment', 1, ['label' => 'Public reply', 'replies' => ['Check your DMs! 📩']]),
                    self::node('ask', 'collect_email', 2, ['label' => 'Ask for email', 'prompt' => 'Hi {{first_name}}! Reply with your email and I will send you the free guide. We will only use it to send this guide.', 'retry_prompt' => 'Hmm, that does not look like an email. Could you check it?', 'max_attempts' => 2, 'marketing_opt_in' => false]),
                    self::node('tag', 'add_tag', 3, ['label' => 'Tag subscriber', 'tag' => 'guide-subscriber']),
                    self::node('thanks', 'send_message', 4, ['label' => 'Confirm', 'text' => 'Perfect, it is on its way to {{email}} ✨']),
                ],
                'edges' => [self::edge('trigger', 'reply'), self::edge('reply', 'ask'), self::edge('ask', 'tag'), self::edge('tag', 'thanks')],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function storyReplyAi(): array
    {
        return [
            'key' => 'story_reply_ai',
            'name' => 'Story reply → AI answer',
            'description' => 'When someone replies to your story, the AI assistant answers from your knowledge base or hands over to your team.',
            'trigger_type' => 'story_reply',
            'trigger_config' => [],
            'flow' => [
                'nodes' => [
                    self::node('trigger', 'trigger', 0, ['label' => 'Story reply']),
                    self::node('ai', 'ai_reply', 1, ['label' => 'AI reply', 'instructions' => 'They are replying to one of our stories.']),
                    self::node('handover', 'handover', 2, ['label' => 'Hand over', 'note' => 'AI was not confident'], 260),
                ],
                'edges' => [self::edge('trigger', 'ai'), self::edge('ai', 'handover', 'handover')],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function faqAssistant(): array
    {
        return [
            'key' => 'dm_keyword_price',
            'name' => 'DM keyword → pricing info',
            'description' => 'Someone DMs "price"; send pricing, tag them and branch on whether they already gave an email.',
            'trigger_type' => 'dm_keyword',
            'trigger_config' => ['keywords' => ['price', 'bei'], 'match' => 'contains'],
            'flow' => [
                'nodes' => [
                    self::node('trigger', 'trigger', 0, ['label' => 'DM contains keyword']),
                    self::node('info', 'send_message', 1, ['label' => 'Send pricing', 'text' => 'Our plans start at $29/month. Want me to send the full price list?', 'wait_for_reply' => true, 'timeout_hours' => 23]),
                    self::node('check', 'condition', 2, ['label' => 'Has email?', 'match' => 'all', 'rules' => [['field' => 'email', 'operator' => 'exists']]]),
                    self::node('tag', 'add_tag', 3, ['label' => 'Tag hot lead', 'tag' => 'pricing-interest']),
                    self::node('ask', 'collect_email', 3, ['label' => 'Ask for email', 'prompt' => 'Sure! What email should I send it to?'], 260),
                ],
                'edges' => [self::edge('trigger', 'info'), self::edge('info', 'check'), self::edge('check', 'tag', 'true'), self::edge('check', 'ask', 'false')],
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private static function blank(): array
    {
        return [
            'key' => 'blank',
            'name' => 'Start from scratch',
            'description' => 'An empty canvas with just a trigger.',
            'trigger_type' => 'comment_keyword',
            'trigger_config' => ['keywords' => [], 'match' => 'contains', 'post_ids' => []],
            'flow' => ['nodes' => [self::node('trigger', 'trigger', 0, ['label' => 'Trigger'])], 'edges' => []],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private static function node(string $id, string $type, int $row, array $data, int $x = 0): array
    {
        return ['id' => $id, 'type' => $type, 'position' => ['x' => 80 + $x, 'y' => 40 + $row * 170], 'data' => $data];
    }

    /**
     * @return array<string, mixed>
     */
    private static function edge(string $source, string $target, ?string $handle = null): array
    {
        return ['id' => "e-{$source}-{$target}", 'source' => $source, 'target' => $target, 'sourceHandle' => $handle];
    }
}
