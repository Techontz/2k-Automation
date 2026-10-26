<?php

namespace App\Http\Controllers\Api\V1;

use App\Enums\AutomationStatus;
use App\Enums\TriggerType;
use App\Http\Controllers\Controller;
use App\Http\Resources\AutomationResource;
use App\Http\Resources\RunResource;
use App\Models\Automation;
use App\Services\AuditLogger;
use App\Services\Automation\FlowGraph;
use App\Services\Automation\FlowTemplates;
use App\Services\Automation\NodeRegistry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AutomationController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $automations = Automation::forWorkspace($this->workspace($request))
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->when($request->query('search'), fn ($query, $search) => $query->where('name', 'like', "%{$search}%"))
            ->orderByRaw("case status when 'active' then 0 when 'paused' then 1 else 2 end")
            ->latest('updated_at')
            ->get();

        return AutomationResource::collection($automations);
    }

    public function templates(): JsonResponse
    {
        return response()->json(['data' => FlowTemplates::all()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'automations.manage');

        $data = $request->validate([
            'template' => ['nullable', 'string'],
            'name' => ['nullable', 'string', 'max:120'],
        ]);

        $template = FlowTemplates::find($data['template'] ?? 'blank') ?? FlowTemplates::find('blank');

        $automation = Automation::create([
            'workspace_id' => $this->workspace($request)->id,
            'created_by' => $request->user()->id,
            'name' => $data['name'] ?? $template['name'],
            'description' => $template['description'],
            'status' => AutomationStatus::Draft,
            'trigger_type' => $template['trigger_type'],
            'trigger_config' => $template['trigger_config'],
            'flow' => $template['flow'],
        ]);

        AuditLogger::log('automation.created', $automation, ['template' => $template['key']]);

        return (new AutomationResource($automation))->response()->setStatusCode(201);
    }

    public function show(Request $request, int $automation): AutomationResource
    {
        return new AutomationResource($this->find($request, $automation));
    }

    public function update(Request $request, int $automation): AutomationResource
    {
        $this->authorizeAbility($request, 'automations.manage');
        $model = $this->find($request, $automation);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'description' => ['sometimes', 'nullable', 'string', 'max:500'],
            'trigger_type' => ['sometimes', Rule::enum(TriggerType::class)],
            'trigger_config' => ['sometimes', 'array'],
            'trigger_config.keywords' => ['sometimes', 'array', 'max:50'],
            'trigger_config.keywords.*' => ['string', 'max:60'],
            'trigger_config.match' => ['sometimes', 'in:contains,exact,any'],
            'trigger_config.post_ids' => ['sometimes', 'array'],
            'trigger_config.channel_ids' => ['sometimes', 'array'],
            'flow' => ['sometimes', 'array'],
            'flow.nodes' => ['required_with:flow', 'array', 'max:200'],
            'flow.nodes.*.id' => ['required', 'string', 'max:64'],
            'flow.nodes.*.type' => ['required', 'string', Rule::in(['trigger', ...array_keys(NodeRegistry::Handlers)])],
            'flow.edges' => ['present_with:flow', 'array'],
            'priority' => ['sometimes', 'integer', 'min:1', 'max:1000'],
        ]);

        // validate() keeps only nested keys that have rules; take the full validated structures from the request.
        foreach (['flow', 'trigger_config'] as $structured) {
            if ($request->has($structured)) {
                $data[$structured] = $request->input($structured);
            }
        }

        $model->fill($data);

        if ($model->status === AutomationStatus::Active) {
            $this->assertActivatable($model);
        }

        $model->save();

        return new AutomationResource($model);
    }

    public function activate(Request $request, int $automation): AutomationResource
    {
        $this->authorizeAbility($request, 'automations.manage');
        $model = $this->find($request, $automation);
        $this->assertActivatable($model);
        $model->update(['status' => AutomationStatus::Active]);
        AuditLogger::log('automation.activated', $model);

        return new AutomationResource($model);
    }

    public function pause(Request $request, int $automation): AutomationResource
    {
        $this->authorizeAbility($request, 'automations.manage');
        $model = $this->find($request, $automation);
        $model->update(['status' => AutomationStatus::Paused]);
        AuditLogger::log('automation.paused', $model);

        return new AutomationResource($model);
    }

    public function duplicate(Request $request, int $automation): JsonResponse
    {
        $this->authorizeAbility($request, 'automations.manage');
        $copy = $this->find($request, $automation)->replicate(['runs_count', 'completed_count', 'failed_count', 'last_run_at']);
        $copy->fill(['name' => $copy->name.' (copy)', 'status' => AutomationStatus::Draft, 'created_by' => $request->user()->id])->save();

        return (new AutomationResource($copy))->response()->setStatusCode(201);
    }

    public function destroy(Request $request, int $automation): JsonResponse
    {
        $this->authorizeAbility($request, 'automations.manage');
        $model = $this->find($request, $automation);
        $model->delete();
        AuditLogger::log('automation.deleted', $model);

        return response()->json(['ok' => true]);
    }

    public function validateFlow(Request $request, int $automation): JsonResponse
    {
        return response()->json(['errors' => $this->problems($this->find($request, $automation))]);
    }

    public function runs(Request $request, int $automation): AnonymousResourceCollection
    {
        $runs = $this->find($request, $automation)->runs()
            ->with('contact')
            ->when($request->query('status'), fn ($query, $status) => $query->where('status', $status))
            ->latest('id')
            ->paginate(25);

        return RunResource::collection($runs);
    }

    private function find(Request $request, int $id): Automation
    {
        return Automation::forWorkspace($this->workspace($request))->findOrFail($id);
    }

    /**
     * @return list<string>
     */
    private function problems(Automation $automation): array
    {
        $errors = (new FlowGraph($automation->flow))->validate();
        $config = $automation->trigger_config;

        if (in_array($automation->trigger_type, [TriggerType::CommentKeyword, TriggerType::DmKeyword, TriggerType::Postback], true)
            && ($config['match'] ?? 'contains') !== 'any'
            && array_filter($config['keywords'] ?? []) === []) {
            $errors[] = 'Add at least one keyword, or choose "any comment".';
        }

        return $errors;
    }

    private function assertActivatable(Automation $automation): void
    {
        if ($errors = $this->problems($automation)) {
            throw ValidationException::withMessages(['flow' => $errors]);
        }
    }
}
