<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\WorkspaceResource;
use App\Services\AuditLogger;
use App\Services\WorkspaceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class WorkspaceController extends Controller
{
    public function __construct(private readonly WorkspaceService $workspaces) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        return WorkspaceResource::collection($request->user()->workspaces()->orderBy('name')->get());
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        $workspace = $this->workspaces->create($request->user(), $data['name']);

        return (new WorkspaceResource($workspace))->response()->setStatusCode(201);
    }

    public function switch(Request $request, int $workspace): JsonResponse
    {
        $target = $request->user()->workspaces()->whereKey($workspace)->firstOrFail();
        $request->user()->forceFill(['current_workspace_id' => $target->id])->save();

        return response()->json(['current_workspace_id' => $target->id]);
    }

    public function current(Request $request): WorkspaceResource
    {
        return new WorkspaceResource($this->workspace($request));
    }

    public function update(Request $request): WorkspaceResource
    {
        $this->authorizeAbility($request, 'settings.manage');

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'timezone' => ['sometimes', 'timezone:all'],
            'default_language' => ['sometimes', 'in:en,sw'],
            'settings' => ['sometimes', 'array'],
            'onboarded' => ['sometimes', 'boolean'],
        ]);

        $workspace = $this->workspace($request);
        $workspace->fill(collect($data)->except(['settings', 'onboarded'])->all());

        if (isset($data['settings'])) {
            $workspace->settings = [...($workspace->settings ?? []), ...$data['settings']];
        }

        if ($data['onboarded'] ?? false) {
            $workspace->onboarded_at ??= now();
        }

        $workspace->save();
        AuditLogger::log('workspace.updated', $workspace, array_keys($data));

        return new WorkspaceResource($workspace);
    }
}
