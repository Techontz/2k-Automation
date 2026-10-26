"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import type { NodeType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NODE_META, handlesFor, summarize, type HandleSpec } from "./node-meta";

export type FlowNodeData = Record<string, unknown> & {
  label?: string;
  /** Injected by the builder for display only; stripped before save. */
  __triggerSummary?: string;
  __errors?: boolean;
  __active?: boolean;
};

export type BuilderNode = Node<FlowNodeData, NodeType>;

const HANDLE_TONES: Record<NonNullable<HandleSpec["tone"]>, string> = {
  default: "text-muted-foreground",
  success: "text-success",
  danger: "text-destructive",
  warning: "text-warning",
};

function FlowNodeCard({ type, data, selected }: NodeProps<BuilderNode>) {
  const meta = NODE_META[type];
  const Icon = meta.icon;
  const handles = handlesFor(type, data);
  const isTrigger = type === "trigger";
  const labelled = handles.length > 1 || handles.some((handle) => handle.label);

  return (
    <div
      className={cn(
        "group relative w-[248px] rounded-xl border bg-card text-left shadow-[0_1px_3px_rgba(16,16,32,0.06)] transition-[box-shadow,border-color]",
        selected ? "border-brand ring-3 ring-brand/15" : "hover:border-foreground/20",
        isTrigger && "border-brand/40",
        data.__errors && !selected && "border-destructive/50",
      )}
    >
      {!isTrigger && (
        <Handle type="target" position={Position.Top} className="!size-2.5 !border-2 !border-brand !bg-card" />
      )}

      <div className="flex items-start gap-2.5 p-3">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", meta.chip)}>
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[0.8rem] font-semibold">{data.label || meta.label}</span>
            {isTrigger && <span className="rounded bg-brand-soft px-1 text-[0.6rem] font-semibold uppercase tracking-wide text-brand">Start</span>}
          </div>
          <p className="mt-0.5 line-clamp-2 text-[0.72rem] leading-snug text-muted-foreground">
            {summarize(type, data, data.__triggerSummary)}
          </p>
        </div>
      </div>

      {labelled && (
        <div className="flex justify-around border-t px-2 py-1.5">
          {handles.map((handle) => (
            <span key={handle.id} className={cn("text-[0.62rem] font-medium uppercase tracking-wide", HANDLE_TONES[handle.tone ?? "default"])}>
              {handle.label ?? "Next"}
            </span>
          ))}
        </div>
      )}

      {handles.map((handle, index) => (
        <Handle
          key={handle.id}
          id={handle.id}
          type="source"
          position={Position.Bottom}
          style={{ left: `${((index + 1) / (handles.length + 1)) * 100}%` }}
          className="!size-2.5 !border-2 !border-brand !bg-card transition-transform hover:!scale-125"
        />
      ))}
    </div>
  );
}

export const FlowNode = memo(FlowNodeCard);
