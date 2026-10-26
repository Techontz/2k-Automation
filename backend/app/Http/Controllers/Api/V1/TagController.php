<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Tag;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TagController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => Tag::forWorkspace($this->workspace($request))->withCount('contacts')->orderBy('name')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeAbility($request, 'contacts.edit');
        $workspace = $this->workspace($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:60', Rule::unique('tags')->where('workspace_id', $workspace->id)],
            'color' => ['nullable', 'regex:/^#[0-9A-Fa-f]{6}$/'],
        ]);

        return response()->json(Tag::create(['workspace_id' => $workspace->id, ...$data]), 201);
    }

    public function destroy(Request $request, int $tag): JsonResponse
    {
        $this->authorizeAbility($request, 'contacts.edit');
        Tag::forWorkspace($this->workspace($request))->findOrFail($tag)->delete();

        return response()->json(['ok' => true]);
    }
}
