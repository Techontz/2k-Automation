<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\RunResource;
use App\Models\AutomationRun;
use App\Services\Automation\FlowExecutor;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class RunController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $runs = AutomationRun::forWorkspace($this->workspace($request))
            ->with(['automation:id,name', 'contact'])
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->has('simulated'), fn ($query) => $query->where('is_simulated', $request->boolean('simulated')))
            ->latest('id')
            ->paginate((int) $request->query('per_page', 25));

        return RunResource::collection($runs);
    }

    public function show(Request $request, int $run): RunResource
    {
        return new RunResource(AutomationRun::forWorkspace($this->workspace($request))->with(['automation:id,name,flow', 'contact.tags', 'steps'])->findOrFail($run));
    }

    public function cancel(Request $request, int $run, FlowExecutor $executor): RunResource
    {
        $this->authorizeAbility($request, 'automations.manage');
        $model = AutomationRun::forWorkspace($this->workspace($request))->findOrFail($run);
        $executor->cancel($model, 'Cancelled by '.$request->user()->name);

        return new RunResource($model->refresh());
    }
}
