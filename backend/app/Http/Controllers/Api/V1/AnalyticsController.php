<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\AutomationStatus;
use App\Http\Controllers\Controller;
use App\Models\Automation;
use App\Models\AutomationRun;
use App\Models\Channel;
use App\Models\Comment;
use App\Models\Contact;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\Workspace;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Real metrics computed from stored events. Simulated data is excluded
 * unless ?include_simulated=1.
 */
class AnalyticsController extends Controller
{
    public function overview(Request $request): JsonResponse
    {
        $workspace = $this->workspace($request);
        [$from, $previousFrom] = $this->range($request);
        $sim = $request->boolean('include_simulated');

        $current = $this->counters($workspace, $from, now(), $sim);
        $previous = $this->counters($workspace, $previousFrom, $from, $sim);

        return response()->json([
            'range_days' => (int) $from->diffInDays(now()),
            'totals' => [
                'channels' => Channel::forWorkspace($workspace)->where('status', 'connected')->when(! $sim, fn ($q) => $q->where('is_simulated', false))->count(),
                'active_automations' => Automation::forWorkspace($workspace)->where('status', AutomationStatus::Active)->count(),
                'contacts' => $this->sim(Contact::forWorkspace($workspace), $sim)->count(),
                'open_conversations' => $this->sim(Conversation::forWorkspace($workspace), $sim)->where('status', 'open')->count(),
                'needs_human' => $this->sim(Conversation::forWorkspace($workspace), $sim)->where('status', 'open')->where('needs_human', true)->count(),
            ],
            'current' => $current,
            'previous' => $previous,
        ]);
    }

    public function timeseries(Request $request): JsonResponse
    {
        $workspace = $this->workspace($request);
        [$from] = $this->range($request);
        $sim = $request->boolean('include_simulated');
        $days = collect();

        for ($day = $from->copy()->startOfDay(); $day->lte(now()); $day->addDay()) {
            $days->put($day->toDateString(), ['date' => $day->toDateString(), 'comments' => 0, 'sent' => 0, 'failed' => 0, 'blocked' => 0, 'received' => 0, 'leads' => 0, 'runs' => 0]);
        }

        $merge = function (string $key, $rows) use ($days): void {
            foreach ($rows as $row) {
                if ($days->has($row->day)) {
                    $days->put($row->day, [...$days->get($row->day), $key => (int) $row->total]);
                }
            }
        };

        $merge('comments', $this->daily($this->sim(Comment::forWorkspace($workspace), $sim), 'commented_at', $from));
        $merge('runs', $this->daily($this->sim(AutomationRun::forWorkspace($workspace), $sim), 'created_at', $from));
        $merge('leads', $this->daily($this->sim(Contact::forWorkspace($workspace), $sim)->whereNotNull('email'), 'updated_at', $from));
        $merge('received', $this->daily($this->sim(Message::forWorkspace($workspace), $sim)->where('direction', 'in'), 'created_at', $from));

        foreach (['sent', 'failed', 'blocked'] as $status) {
            $statuses = $status === 'sent' ? ['sent', 'delivered', 'read'] : [$status];
            $merge($status, $this->daily($this->sim(Message::forWorkspace($workspace), $sim)->where('direction', 'out')->whereIn('status', $statuses), 'created_at', $from));
        }

        return response()->json(['data' => $days->values()]);
    }

    public function automations(Request $request): JsonResponse
    {
        $workspace = $this->workspace($request);
        [$from] = $this->range($request);
        $sim = $request->boolean('include_simulated');

        $stats = AutomationRun::forWorkspace($workspace)
            ->when(! $sim, fn ($q) => $q->where('is_simulated', false))
            ->where('created_at', '>=', $from)
            ->select('automation_id', 'status', DB::raw('count(*) as total'))
            ->groupBy('automation_id', 'status')
            ->toBase()
            ->get()
            ->groupBy('automation_id');

        $rows = Automation::forWorkspace($workspace)->get(['id', 'name', 'status', 'trigger_type'])->map(function (Automation $automation) use ($stats): array {
            $byStatus = ($stats[$automation->id] ?? collect())->pluck('total', 'status');
            $total = (int) $byStatus->sum();

            return [
                'id' => $automation->id,
                'name' => $automation->name,
                'status' => $automation->status->value,
                'trigger_type' => $automation->trigger_type->value,
                'runs' => $total,
                'completed' => (int) ($byStatus['completed'] ?? 0),
                'failed' => (int) ($byStatus['failed'] ?? 0),
                'waiting' => (int) ($byStatus['waiting'] ?? 0),
                'success_rate' => $total > 0 ? round(($byStatus['completed'] ?? 0) / $total * 100, 1) : null,
            ];
        })->sortByDesc('runs')->values();

        return response()->json(['data' => $rows]);
    }

    /**
     * @return array<string, int|float|null>
     */
    private function counters(Workspace $workspace, Carbon $from, Carbon $to, bool $sim): array
    {
        $outbound = $this->sim(Message::forWorkspace($workspace), $sim)->where('direction', 'out')->whereBetween('created_at', [$from, $to]);
        $sent = (clone $outbound)->whereIn('status', ['sent', 'delivered', 'read'])->count();
        $failed = (clone $outbound)->where('status', 'failed')->count();

        return [
            'comments_processed' => $this->sim(Comment::forWorkspace($workspace), $sim)->whereBetween('commented_at', [$from, $to])->count(),
            'keyword_matches' => $this->sim(Comment::forWorkspace($workspace), $sim)->whereNotNull('matched_keyword')->whereBetween('commented_at', [$from, $to])->count(),
            'messages_sent' => $sent,
            'messages_failed' => $failed,
            'messages_blocked' => (clone $outbound)->where('status', 'blocked')->count(),
            'private_replies' => (clone $outbound)->where('kind', 'private_reply')->whereIn('status', ['sent', 'delivered', 'read'])->count(),
            'messages_received' => $this->sim(Message::forWorkspace($workspace), $sim)->where('direction', 'in')->whereBetween('created_at', [$from, $to])->count(),
            'runs' => $this->sim(AutomationRun::forWorkspace($workspace), $sim)->whereBetween('created_at', [$from, $to])->count(),
            'new_contacts' => $this->sim(Contact::forWorkspace($workspace), $sim)->whereBetween('created_at', [$from, $to])->count(),
            'leads_with_email' => $this->sim(Contact::forWorkspace($workspace), $sim)->whereNotNull('email')->whereBetween('updated_at', [$from, $to])->count(),
            'delivery_rate' => ($sent + $failed) > 0 ? round($sent / ($sent + $failed) * 100, 1) : null,
        ];
    }

    /**
     * @template TModel of \Illuminate\Database\Eloquent\Model
     *
     * @param  Builder<TModel>  $query
     * @return Builder<TModel>
     */
    private function sim(Builder $query, bool $includeSimulated): Builder
    {
        return $includeSimulated ? $query : $query->where($query->getModel()->getTable().'.is_simulated', false);
    }

    /**
     * @param  Builder<Model>  $query
     */
    private function daily(Builder $query, string $column, Carbon $from): Collection
    {
        return $query->where($column, '>=', $from)
            ->selectRaw("date({$column}) as day, count(*) as total")
            ->groupByRaw("date({$column})")
            ->toBase()
            ->get();
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    private function range(Request $request): array
    {
        $days = in_array((int) $request->query('days', 30), [7, 14, 30, 90], true) ? (int) $request->query('days', 30) : 30;

        return [now()->subDays($days), now()->subDays($days * 2)];
    }
}
