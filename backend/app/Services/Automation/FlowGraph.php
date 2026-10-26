<?php

namespace App\Services\Automation;

/**
 * Read-only view over a React Flow document: {nodes: [{id, type, data}], edges: [{source, target, sourceHandle}]}.
 */
class FlowGraph
{
    /** @var array<string, array<string, mixed>> */
    private array $nodes = [];

    /** @var list<array<string, mixed>> */
    private array $edges;

    /**
     * @param  array{nodes?: list<array<string, mixed>>, edges?: list<array<string, mixed>>}  $flow
     */
    public function __construct(array $flow)
    {
        foreach ($flow['nodes'] ?? [] as $node) {
            $this->nodes[(string) $node['id']] = $node;
        }

        $this->edges = $flow['edges'] ?? [];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function node(?string $id): ?array
    {
        return $id === null ? null : ($this->nodes[$id] ?? null);
    }

    public function triggerId(): ?string
    {
        foreach ($this->nodes as $id => $node) {
            if (($node['type'] ?? null) === 'trigger') {
                return $id;
            }
        }

        return null;
    }

    /**
     * Follow the outgoing edge for a handle. "default" matches unnamed handles.
     */
    public function next(string $nodeId, string $handle = 'default'): ?string
    {
        foreach ($this->edges as $edge) {
            if ((string) $edge['source'] !== $nodeId) {
                continue;
            }

            $edgeHandle = $edge['sourceHandle'] ?? null;

            if ($edgeHandle === $handle || ($handle === 'default' && in_array($edgeHandle, [null, '', 'default', 'out'], true))) {
                return (string) $edge['target'];
            }
        }

        return null;
    }

    /**
     * Structural problems that make a flow unsafe to activate.
     *
     * @return list<string>
     */
    public function validate(): array
    {
        $errors = [];

        if ($this->triggerId() === null) {
            $errors[] = 'The flow needs a trigger node.';
        } elseif ($this->next($this->triggerId()) === null) {
            $errors[] = 'Connect the trigger to the first step.';
        }

        foreach ($this->edges as $edge) {
            if (! isset($this->nodes[(string) $edge['source']], $this->nodes[(string) $edge['target']])) {
                $errors[] = 'A connection points to a step that no longer exists.';
                break;
            }
        }

        foreach ($this->nodes as $node) {
            $data = $node['data'] ?? [];
            $label = $data['label'] ?? $node['type'];

            $missing = match ($node['type'] ?? null) {
                'send_message' => trim((string) ($data['text'] ?? '')) === '',
                'reply_comment' => array_filter($data['replies'] ?? [], fn ($reply): bool => trim((string) $reply) !== '') === [],
                'add_tag', 'remove_tag' => trim((string) ($data['tag'] ?? '')) === '',
                'send_email' => empty($data['template_id']),
                'send_template' => trim((string) ($data['template'] ?? '')) === '',
                default => false,
            };

            if ($missing) {
                $errors[] = "\"{$label}\" is missing required content.";
            }
        }

        return $errors;
    }
}
