"use client";

import "@xyflow/react/dist/style.css";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import { AlertTriangle, ArrowLeft, FlaskConical, History, Loader2, Pause, Play, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatusBadge } from "@/components/app/status-badge";
import { useCan } from "@/hooks/use-session";
import { ApiError, api } from "@/lib/api";
import type { Automation, FlowEdge, FlowNode, NodeType, TriggerConfig, TriggerType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FlowNode as FlowNodeCard, type BuilderNode } from "./flow-node";
import { Inspector } from "./inspector";
import { NODE_META, PALETTE_GROUPS, TRIGGER_OPTIONS, handlesFor } from "./node-meta";
import { RunsPanel } from "./runs-panel";

const DRAG_TYPE = "application/x-2k-node";

const nodeTypes = Object.fromEntries(Object.keys(NODE_META).map((type) => [type, FlowNodeCard]));

const defaultEdgeOptions = {
  type: "smoothstep",
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
  style: { strokeWidth: 1.5 },
};

function toBuilderNodes(nodes: FlowNode[]): BuilderNode[] {
  return nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: node.position ?? { x: 80, y: 40 },
    data: { ...node.data },
    deletable: node.type !== "trigger",
  }));
}

function toBuilderEdges(edges: FlowEdge[]): Edge[] {
  return edges.map((edge) => ({
    id: edge.id ?? `e-${edge.source}-${edge.sourceHandle ?? "default"}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle ?? null,
  }));
}

function triggerSummary(type: TriggerType, config: TriggerConfig): string {
  const label = TRIGGER_OPTIONS.find((option) => option.value === type)?.label ?? type;
  if (config.match === "any") return type === "comment_keyword" ? "Any comment" : label;
  const keywords = config.keywords ?? [];
  if (["comment_keyword", "dm_keyword", "postback"].includes(type)) {
    const scope = type === "comment_keyword" ? (config.post_ids?.length ? ` · ${config.post_ids.length} post${config.post_ids.length > 1 ? "s" : ""}` : " · all posts") : "";
    return keywords.length ? `${label}: ${keywords.join(", ")}${scope}` : `${label} — add keywords`;
  }
  return label;
}

function newId(): string {
  return crypto.randomUUID().slice(0, 8);
}

export function FlowBuilder({ automation }: { automation: Automation }) {
  return (
    <ReactFlowProvider>
      <Builder automation={automation} />
    </ReactFlowProvider>
  );
}

function Builder({ automation }: { automation: Automation }) {
  const canEdit = useCan("automations.manage");
  const { mutate } = useSWRConfig();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(automation.name);
  const [status, setStatus] = useState(automation.status);
  const [triggerType, setTriggerType] = useState<TriggerType>(automation.trigger_type);
  const [triggerConfig, setTriggerConfig] = useState<TriggerConfig>(automation.trigger_config ?? {});
  const [nodes, setNodes, onNodesChangeBase] = useNodesState<BuilderNode>(toBuilderNodes(automation.flow?.nodes ?? []));
  const [edges, setEdges, onEdgesChangeBase] = useEdgesState<Edge>(toBuilderEdges(automation.flow?.edges ?? []));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [runsOpen, setRunsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const summary = useMemo(() => triggerSummary(triggerType, triggerConfig), [triggerType, triggerConfig]);
  const displayNodes = useMemo(
    () => nodes.map((node) => (node.type === "trigger" ? { ...node, data: { ...node.data, __triggerSummary: summary } } : node)),
    [nodes, summary],
  );
  const selected = nodes.find((node) => node.id === selectedId) ?? null;

  const onNodesChange = useCallback(
    (changes: NodeChange<BuilderNode>[]) => {
      const safe = changes.filter((change) => !(change.type === "remove" && nodes.find((node) => node.id === change.id)?.type === "trigger"));
      if (safe.some((change) => change.type !== "select" && change.type !== "dimensions")) setDirty(true);
      if (safe.some((change) => change.type === "remove" && change.id === selectedId)) setSelectedId(null);
      onNodesChangeBase(safe);
    },
    [nodes, onNodesChangeBase, selectedId],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      if (changes.some((change) => change.type !== "select")) setDirty(true);
      onEdgesChangeBase(changes);
    },
    [onEdgesChangeBase],
  );

  /** One edge per source handle: the engine follows a single path per outcome. */
  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === connection.target) return;
      const handle = connection.sourceHandle ?? "default";
      setEdges((current) => [
        ...current.filter((edge) => !(edge.source === connection.source && (edge.sourceHandle ?? "default") === handle)),
        { id: `e-${connection.source}-${handle}-${connection.target}`, source: connection.source, target: connection.target, sourceHandle: connection.sourceHandle ?? null },
      ]);
      setDirty(true);
    },
    [setEdges],
  );

  const addNode = useCallback(
    (type: NodeType, position?: { x: number; y: number }) => {
      const meta = NODE_META[type];
      const anchor = selected ?? [...nodes].sort((a, b) => b.position.y - a.position.y)[0];
      const id = newId();
      const placed = position ?? (anchor ? { x: anchor.position.x, y: anchor.position.y + 170 } : { x: 80, y: 40 });

      setNodes((current) => [
        ...current.map((node) => ({ ...node, selected: false })),
        { id, type, position: placed, data: structuredClone(meta.defaults), selected: true, deletable: true },
      ]);

      if (!position && anchor) {
        const handles = handlesFor(anchor.type as NodeType, anchor.data);
        const free = handles.find((handle) => !edges.some((edge) => edge.source === anchor.id && (edge.sourceHandle ?? "default") === handle.id));
        if (free) {
          setEdges((current) => [...current, { id: `e-${anchor.id}-${free.id}-${id}`, source: anchor.id, target: id, sourceHandle: free.id === "default" ? null : free.id }]);
        }
      }

      setSelectedId(id);
      setDirty(true);
      setPaletteOpen(false);
    },
    [edges, nodes, selected, setEdges, setNodes],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData(DRAG_TYPE) as NodeType;
      if (!type || !NODE_META[type]) return;
      addNode(type, screenToFlowPosition({ x: event.clientX - 124, y: event.clientY - 30 }));
    },
    [addNode, screenToFlowPosition],
  );

  function updateSelected(patch: Record<string, unknown>) {
    if (!selectedId) return;
    setNodes((current) => current.map((node) => (node.id === selectedId ? { ...node, data: { ...node.data, ...patch } } : node)));
    setDirty(true);
  }

  function deleteSelected() {
    if (!selected || selected.type === "trigger") return;
    setNodes((current) => current.filter((node) => node.id !== selected.id));
    setEdges((current) => current.filter((edge) => edge.source !== selected.id && edge.target !== selected.id));
    setSelectedId(null);
    setDirty(true);
  }

  function payload() {
    return {
      name: name.trim() || "Untitled automation",
      trigger_type: triggerType,
      trigger_config: triggerConfig,
      flow: {
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
          data: Object.fromEntries(Object.entries(node.data).filter(([key]) => !key.startsWith("__"))),
        })),
        edges: edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, sourceHandle: edge.sourceHandle ?? null })),
      },
    };
  }

  function collectErrors(error: unknown): string[] {
    if (error instanceof ApiError && error.status === 422) {
      const list = Object.values(error.errors).flat();
      return list.length ? list : [error.message];
    }
    return [(error as Error).message];
  }

  async function save(quiet = false): Promise<boolean> {
    setSaving(true);
    try {
      const response = await api.patch<{ data: Automation }>(`automations/${automation.id}`, payload());
      await mutate(`automations/${automation.id}`, response, { revalidate: false });
      setDirty(false);
      setErrors([]);
      if (!quiet) toast.success("Automation saved");
      return true;
    } catch (error) {
      const list = collectErrors(error);
      setErrors(list);
      toast.error(list[0] ?? "Could not save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus() {
    if (status === "active") {
      try {
        await api.post(`automations/${automation.id}/pause`);
        setStatus("paused");
        toast.success("Automation paused");
      } catch (error) {
        toast.error((error as Error).message);
      }
      return;
    }

    if (!(await save(true))) return;
    try {
      await api.post(`automations/${automation.id}/activate`);
      setStatus("active");
      setErrors([]);
      toast.success("Automation is live");
    } catch (error) {
      const list = collectErrors(error);
      setErrors(list);
      toast.error("Fix the highlighted issues before activating");
    }
  }

  const palette = (
    <div className="space-y-5 p-3">
      {PALETTE_GROUPS.map((group) => (
        <div key={group.label}>
          <p className="mb-1.5 px-1 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">{group.label}</p>
          <div className="space-y-1">
            {group.types.map((type) => {
              const meta = NODE_META[type];
              const Icon = meta.icon;
              return (
                <button
                  key={type}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(DRAG_TYPE, type);
                    event.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => addNode(type)}
                  className="flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-border hover:bg-card active:cursor-grabbing"
                >
                  <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", meta.chip)}>
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[0.8rem] font-medium leading-tight">{meta.label}</span>
                    <span className="block truncate text-[0.68rem] text-muted-foreground">{meta.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );

  const inspector = selected && (
    <Inspector
      node={selected}
      triggerType={triggerType}
      triggerConfig={triggerConfig}
      readOnly={!canEdit}
      onChange={updateSelected}
      onTriggerChange={(type, config) => {
        setTriggerType(type);
        setTriggerConfig(config);
        setDirty(true);
      }}
      onDelete={deleteSelected}
    />
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 sm:px-4">
        <Link href="/automations" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Back to automations">
          <ArrowLeft className="size-4" />
        </Link>
        <input
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setDirty(true);
          }}
          disabled={!canEdit}
          aria-label="Automation name"
          className="min-w-0 flex-1 truncate rounded-md bg-transparent px-1.5 py-1 text-[0.95rem] font-semibold outline-none transition-colors hover:bg-muted focus:bg-muted sm:max-w-sm"
        />
        <StatusBadge status={status} className="hidden sm:inline-flex" />
        {dirty && <span className="hidden items-center gap-1.5 text-xs text-muted-foreground md:flex"><span className="size-1.5 rounded-full bg-warning" /> Unsaved changes</span>}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => setRunsOpen(true)}>
          <History className="size-3.5" /> <span className="hidden sm:inline">Runs</span>
        </Button>
        <Link href={`/simulator?automation=${automation.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "hidden sm:inline-flex")}>
          <FlaskConical className="size-3.5" /> Test
        </Link>
        {canEdit && (
          <>
            <Button variant="outline" size="sm" onClick={() => save()} disabled={saving || !dirty}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Save
            </Button>
            <Button size="sm" onClick={toggleStatus} disabled={saving} variant={status === "active" ? "secondary" : "default"}>
              {status === "active" ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
              {status === "active" ? "Pause" : "Activate"}
            </Button>
          </>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Palette */}
        {canEdit && <aside className="hidden w-60 shrink-0 overflow-y-auto border-r bg-sidebar scrollbar-thin md:block">{palette}</aside>}

        {/* Canvas */}
        <div ref={wrapper} className="relative min-w-0 flex-1 bg-background" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; }} onDrop={onDrop}>
          <ReactFlow
            nodes={displayNodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            defaultEdgeOptions={defaultEdgeOptions}
            deleteKeyCode={canEdit ? ["Backspace", "Delete"] : null}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            minZoom={0.3}
            proOptions={{ hideAttribution: true }}
          >
            <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} color="var(--border)" />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap pannable zoomable position="bottom-right" style={{ width: 150, height: 96 }} className="!hidden !overflow-hidden !rounded-lg !border !bg-card lg:!block" maskColor="color-mix(in oklab, var(--background) 70%, transparent)" nodeColor="var(--brand)" nodeBorderRadius={6} />
          </ReactFlow>

          {canEdit && (
            <Button size="sm" className="absolute left-3 top-3 shadow-md md:hidden" onClick={() => setPaletteOpen(true)}>
              <Plus className="size-3.5" /> Add step
            </Button>
          )}

          {errors.length > 0 && (
            <div className="absolute left-1/2 top-3 z-10 w-[min(92%,440px)] -translate-x-1/2 animate-in-up rounded-xl border border-destructive/30 bg-card p-3 shadow-lg">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Fix these before going live</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    {errors.map((error) => <li key={error}>{error}</li>)}
                  </ul>
                </div>
                <Button variant="ghost" size="icon-xs" onClick={() => setErrors([])} aria-label="Dismiss">
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          )}

          {nodes.length <= 1 && canEdit && (
            <div className="pointer-events-none absolute inset-x-0 bottom-16 flex justify-center">
              <p className="rounded-full border bg-card px-3 py-1.5 text-xs text-muted-foreground shadow-sm">Drag a step from the left, or click one to add it after the selected step</p>
            </div>
          )}
        </div>

        {/* Inspector */}
        <aside className={cn("hidden w-[340px] shrink-0 border-l bg-card lg:block", !selected && "lg:hidden xl:block")}>
          {inspector ?? (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <p className="text-sm font-medium">Select a step</p>
              <p className="mt-1 text-xs text-muted-foreground">Click any step on the canvas to edit it. Start with the trigger to set your keywords.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => { const trigger = nodes.find((node) => node.type === "trigger"); if (trigger) { setSelectedId(trigger.id); fitView({ nodes: [trigger], maxZoom: 1, duration: 300 }); } }}>
                Edit trigger
              </Button>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile inspector */}
      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent className="w-full p-0 sm:max-w-md lg:hidden" showCloseButton={false}>
          <SheetTitle className="sr-only">Edit step</SheetTitle>
          {inspector}
        </SheetContent>
      </Sheet>

      {/* Mobile palette */}
      <Sheet open={paletteOpen} onOpenChange={setPaletteOpen}>
        <SheetContent side="left" className="w-72 overflow-y-auto p-0">
          <SheetHeader className="border-b">
            <SheetTitle>Add a step</SheetTitle>
          </SheetHeader>
          {palette}
        </SheetContent>
      </Sheet>

      {/* Runs */}
      <Sheet open={runsOpen} onOpenChange={setRunsOpen}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-md">
          <SheetHeader className="border-b">
            <SheetTitle>Run history</SheetTitle>
          </SheetHeader>
          {runsOpen && <RunsPanel automationId={automation.id} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
