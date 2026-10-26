<?php

namespace App\Jobs;

use App\Models\WebhookEvent;
use App\Services\Platforms\PlatformException;
use App\Services\Webhooks\EventIngestor;
use App\Services\Webhooks\InboundEvent;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ProcessWebhookEvent implements ShouldQueue
{
    use Queueable;

    public int $tries = 5;

    /** @var list<int> */
    public array $backoff = [10, 60, 300, 900];

    public function __construct(public int $webhookEventId) {}

    public function handle(EventIngestor $ingestor): void
    {
        $event = WebhookEvent::find($this->webhookEventId);

        if (! $event || $event->status === 'processed') {
            return;
        }

        $event->forceFill(['status' => 'processing', 'attempts' => $event->attempts + 1])->save();

        try {
            $outcome = $ingestor->ingest(InboundEvent::fromArray($event->payload), $event);
        } catch (PlatformException $exception) {
            if ($exception->isRetryable() && $this->job?->getConnectionName() !== 'sync') {
                $event->forceFill(['status' => 'retrying', 'error' => $exception->getMessage()])->save();
                $this->release($exception->retryAfterSeconds);

                return;
            }

            throw $exception;
        }

        $event->forceFill([
            'status' => str_starts_with($outcome, 'ignored') ? 'ignored' : 'processed',
            'outcome' => mb_strimwidth($outcome, 0, 250),
            'error' => null,
            'processed_at' => now(),
        ])->save();
    }

    public function failed(Throwable $exception): void
    {
        WebhookEvent::whereKey($this->webhookEventId)->update([
            'status' => 'failed',
            'error' => mb_strimwidth($exception->getMessage(), 0, 1000),
        ]);
    }
}
