<?php

namespace App\Services\Automation;

use App\Enums\AutomationStatus;
use App\Enums\TriggerType;
use App\Models\Automation;
use App\Models\Channel;
use App\Models\Comment;
use App\Models\Contact;
use Illuminate\Support\Collection;

/**
 * Finds the highest-priority active automation for an inbound comment or message.
 *
 * trigger_config keys: keywords[], match (contains|exact|any), exclude_keywords[],
 * channel_ids[], post_ids[] (empty = all posts), once_per_contact (bool).
 */
class TriggerMatcher
{
    public function matchComment(Channel $channel, Comment $comment): ?TriggerMatch
    {
        foreach ($this->candidates($channel, [TriggerType::CommentKeyword]) as $automation) {
            $config = $automation->trigger_config;
            $postIds = array_map('intval', $config['post_ids'] ?? []);

            if ($postIds !== [] && ! in_array((int) $comment->post_id, $postIds, true)) {
                continue;
            }

            if (($config['skip_replies'] ?? true) && $comment->parent_external_id) {
                continue;
            }

            $keyword = $this->matchText($comment->text, $config);

            if ($keyword !== false && $this->allowedForContact($automation, $comment->contact_id)) {
                return new TriggerMatch($automation, $keyword);
            }
        }

        return null;
    }

    public function matchMessage(Channel $channel, Contact $contact, string $text, bool $isStoryReply = false, ?string $postback = null): ?TriggerMatch
    {
        $types = $isStoryReply
            ? [TriggerType::StoryReply, TriggerType::DmKeyword, TriggerType::AnyDm]
            : [TriggerType::Postback, TriggerType::DmKeyword, TriggerType::AnyDm];

        foreach ($this->candidates($channel, $types) as $automation) {
            if (! $this->allowedForContact($automation, $contact->id)) {
                continue;
            }

            $candidate = $automation->trigger_type === TriggerType::Postback ? (string) $postback : $text;

            if ($automation->trigger_type === TriggerType::Postback && $postback === null) {
                continue;
            }

            if (in_array($automation->trigger_type, [TriggerType::AnyDm, TriggerType::StoryReply], true)) {
                return new TriggerMatch($automation, null);
            }

            $keyword = $this->matchText($candidate, $automation->trigger_config);

            if ($keyword !== false) {
                return new TriggerMatch($automation, $keyword);
            }
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $config
     * @return string|null|false Matched keyword, null for "any", or false for no match.
     */
    public function matchText(string $text, array $config): string|null|false
    {
        $normalized = $this->normalize($text);

        foreach ($config['exclude_keywords'] ?? [] as $excluded) {
            if ($this->containsWord($normalized, $this->normalize($excluded))) {
                return false;
            }
        }

        $mode = $config['match'] ?? 'contains';

        if ($mode === 'any') {
            return null;
        }

        foreach ($config['keywords'] ?? [] as $keyword) {
            $needle = $this->normalize($keyword);

            if ($needle === '') {
                continue;
            }

            if ($mode === 'exact' ? $normalized === $needle : $this->containsWord($normalized, $needle)) {
                return $keyword;
            }
        }

        return false;
    }

    /**
     * @param  list<TriggerType>  $types
     * @return Collection<int, Automation>
     */
    private function candidates(Channel $channel, array $types): Collection
    {
        return Automation::query()
            ->forWorkspace($channel->workspace_id)
            ->where('status', AutomationStatus::Active)
            ->whereIn('trigger_type', array_map(fn (TriggerType $type): string => $type->value, $types))
            ->orderBy('priority')
            ->orderBy('id')
            ->get()
            ->filter(function (Automation $automation) use ($channel): bool {
                $channelIds = array_map('intval', $automation->trigger_config['channel_ids'] ?? []);

                return $channelIds === [] || in_array($channel->id, $channelIds, true);
            })
            ->sortBy(fn (Automation $automation): int => array_search($automation->trigger_type, $types, true) * 10000 + $automation->priority)
            ->values();
    }

    private function allowedForContact(Automation $automation, ?int $contactId): bool
    {
        if (! ($automation->trigger_config['once_per_contact'] ?? false) || $contactId === null) {
            return true;
        }

        return ! $automation->runs()->where('contact_id', $contactId)->exists();
    }

    private function normalize(string $text): string
    {
        return trim(preg_replace('/\s+/u', ' ', mb_strtolower($text)) ?? '');
    }

    private function containsWord(string $haystack, string $needle): bool
    {
        return (bool) preg_match('/(?<![\p{L}\p{N}])'.preg_quote($needle, '/').'(?![\p{L}\p{N}])/u', $haystack);
    }
}
