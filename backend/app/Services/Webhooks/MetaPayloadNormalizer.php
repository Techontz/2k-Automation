<?php

namespace App\Services\Webhooks;

use Illuminate\Support\Carbon;

/**
 * Converts Meta webhook deliveries (Instagram, Page, WhatsApp) into InboundEvents.
 * One HTTP delivery may batch many entries and events.
 */
class MetaPayloadNormalizer
{
    /**
     * @param  array<string, mixed>  $payload
     * @return list<InboundEvent>
     */
    public function normalize(array $payload): array
    {
        $object = $payload['object'] ?? null;
        $events = [];

        foreach ($payload['entry'] ?? [] as $entry) {
            $events = [...$events, ...match ($object) {
                'instagram' => $this->instagram($entry),
                'page' => $this->page($entry),
                'whatsapp_business_account' => $this->whatsapp($entry),
                default => [],
            }];
        }

        return $events;
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return list<InboundEvent>
     */
    private function instagram(array $entry): array
    {
        $accountId = (string) $entry['id'];
        $events = [];

        foreach ($entry['changes'] ?? [] as $change) {
            if (($change['field'] ?? null) !== 'comments' && ($change['field'] ?? null) !== 'live_comments') {
                continue;
            }

            $value = $change['value'];
            $events[] = new InboundEvent(
                platform: 'instagram',
                type: InboundEvent::Comment,
                accountId: $accountId,
                externalId: (string) $value['id'],
                senderId: isset($value['from']['id']) ? (string) $value['from']['id'] : null,
                senderUsername: $value['from']['username'] ?? null,
                text: $value['text'] ?? '',
                mediaId: isset($value['media']['id']) ? (string) $value['media']['id'] : null,
                mediaType: ($value['media']['media_product_type'] ?? null) === 'REELS' ? 'reel' : 'post',
                parentId: $value['parent_id'] ?? null,
                occurredAt: isset($entry['time']) ? Carbon::createFromTimestamp($entry['time']) : now(),
            );
        }

        return [...$events, ...$this->messaging('instagram', $accountId, $entry['messaging'] ?? [])];
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return list<InboundEvent>
     */
    private function page(array $entry): array
    {
        $accountId = (string) $entry['id'];
        $events = [];

        foreach ($entry['changes'] ?? [] as $change) {
            $value = $change['value'] ?? [];

            if (($change['field'] ?? null) !== 'feed' || ($value['item'] ?? null) !== 'comment' || ($value['verb'] ?? null) !== 'add') {
                continue;
            }

            $events[] = new InboundEvent(
                platform: 'facebook',
                type: InboundEvent::Comment,
                accountId: $accountId,
                externalId: (string) $value['comment_id'],
                senderId: isset($value['from']['id']) ? (string) $value['from']['id'] : null,
                senderName: $value['from']['name'] ?? null,
                text: $value['message'] ?? '',
                mediaId: $value['post_id'] ?? null,
                mediaType: 'post',
                parentId: ($value['parent_id'] ?? null) !== ($value['post_id'] ?? null) ? ($value['parent_id'] ?? null) : null,
                occurredAt: isset($value['created_time']) ? Carbon::createFromTimestamp($value['created_time']) : now(),
            );
        }

        return [...$events, ...$this->messaging('facebook', $accountId, $entry['messaging'] ?? [])];
    }

    /**
     * Messenger Platform style events, shared by Instagram and Pages.
     *
     * @param  list<array<string, mixed>>  $messaging
     * @return list<InboundEvent>
     */
    private function messaging(string $platform, string $accountId, array $messaging): array
    {
        $events = [];

        foreach ($messaging as $item) {
            $senderId = (string) ($item['sender']['id'] ?? '');
            $occurredAt = isset($item['timestamp']) ? Carbon::createFromTimestampMs($item['timestamp']) : now();

            if (isset($item['message'])) {
                $message = $item['message'];
                $events[] = new InboundEvent(
                    platform: $platform,
                    type: InboundEvent::Message,
                    accountId: $accountId,
                    externalId: (string) ($message['mid'] ?? $senderId.':'.($item['timestamp'] ?? '')),
                    senderId: $senderId,
                    text: $message['text'] ?? ($message['quick_reply']['payload'] ?? null),
                    isEcho: (bool) ($message['is_echo'] ?? false),
                    isStoryReply: isset($message['reply_to']['story']),
                    postbackPayload: $message['quick_reply']['payload'] ?? null,
                    occurredAt: $occurredAt,
                    extra: array_filter(['attachments' => $message['attachments'] ?? null]),
                );
            } elseif (isset($item['postback'])) {
                $events[] = new InboundEvent(
                    platform: $platform,
                    type: InboundEvent::Postback,
                    accountId: $accountId,
                    externalId: (string) ($item['postback']['mid'] ?? $senderId.':'.($item['timestamp'] ?? '')),
                    senderId: $senderId,
                    text: $item['postback']['title'] ?? null,
                    postbackPayload: $item['postback']['payload'] ?? null,
                    occurredAt: $occurredAt,
                );
            } elseif (isset($item['read']) || isset($item['delivery'])) {
                $mids = $item['delivery']['mids'] ?? (isset($item['read']['mid']) ? [$item['read']['mid']] : []);
                foreach ($mids as $mid) {
                    $events[] = new InboundEvent(
                        platform: $platform,
                        type: InboundEvent::Status,
                        accountId: $accountId,
                        externalId: (string) $mid,
                        senderId: $senderId,
                        text: isset($item['read']) ? 'read' : 'delivered',
                        occurredAt: $occurredAt,
                    );
                }
            }
        }

        return $events;
    }

    /**
     * @param  array<string, mixed>  $entry
     * @return list<InboundEvent>
     */
    private function whatsapp(array $entry): array
    {
        $events = [];

        foreach ($entry['changes'] ?? [] as $change) {
            if (($change['field'] ?? null) !== 'messages') {
                continue;
            }

            $value = $change['value'];
            $accountId = (string) ($value['metadata']['phone_number_id'] ?? '');
            $names = collect($value['contacts'] ?? [])->mapWithKeys(fn (array $contact): array => [$contact['wa_id'] => $contact['profile']['name'] ?? null]);

            foreach ($value['messages'] ?? [] as $message) {
                $interactive = $message['interactive'] ?? [];
                $reply = $interactive['button_reply'] ?? $interactive['list_reply'] ?? $message['button'] ?? null;

                $events[] = new InboundEvent(
                    platform: 'whatsapp',
                    type: $reply ? InboundEvent::Postback : InboundEvent::Message,
                    accountId: $accountId,
                    externalId: (string) $message['id'],
                    senderId: (string) $message['from'],
                    senderName: $names[$message['from']] ?? null,
                    text: $message['text']['body'] ?? $reply['title'] ?? $reply['text'] ?? null,
                    postbackPayload: $reply['id'] ?? $reply['payload'] ?? null,
                    occurredAt: isset($message['timestamp']) ? Carbon::createFromTimestamp($message['timestamp']) : now(),
                    extra: ['phone' => $message['from']],
                );
            }

            foreach ($value['statuses'] ?? [] as $status) {
                $events[] = new InboundEvent(
                    platform: 'whatsapp',
                    type: InboundEvent::Status,
                    accountId: $accountId,
                    externalId: (string) $status['id'].':'.$status['status'],
                    text: $status['status'],
                    occurredAt: now(),
                    extra: ['message_id' => $status['id'], 'errors' => $status['errors'] ?? null],
                );
            }
        }

        return $events;
    }
}
