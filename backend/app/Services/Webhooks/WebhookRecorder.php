<?php

namespace App\Services\Webhooks;

use App\Jobs\ProcessWebhookEvent;
use App\Models\WebhookEvent;
use Illuminate\Database\UniqueConstraintViolationException;

/**
 * Persists each normalised event exactly once (platforms retry deliveries)
 * and queues it for processing.
 */
class WebhookRecorder
{
    /**
     * @param  list<InboundEvent>  $events
     * @return int Number of new (non-duplicate) events queued.
     */
    public function record(array $events, bool $simulated = false): int
    {
        $queued = 0;

        foreach ($events as $event) {
            try {
                $webhookEvent = WebhookEvent::create([
                    'platform' => $event->platform,
                    'dedupe_key' => ($simulated ? 'sim:' : '').$event->dedupeKey(),
                    'is_simulated' => $simulated,
                    'event_type' => $event->type,
                    'payload' => $event->toArray(),
                ]);
            } catch (UniqueConstraintViolationException) {
                continue;
            }

            if ($simulated && config('automation.simulator_sync')) {
                ProcessWebhookEvent::dispatchSync($webhookEvent->id);
            } else {
                ProcessWebhookEvent::dispatch($webhookEvent->id)->onQueue(config('automation.queues.webhooks'));
            }
            $queued++;
        }

        return $queued;
    }
}
