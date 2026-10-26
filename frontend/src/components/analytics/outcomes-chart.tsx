"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { shortDate } from "@/lib/format";
import type { TimeseriesPoint } from "@/lib/types";

/** Delivery outcomes are states, so they use the reserved status colors and always carry labels. */
const OUTCOMES = [
  { key: "sent", label: "Delivered", color: "var(--success)" },
  { key: "blocked", label: "Blocked by policy", color: "var(--warning)" },
  { key: "failed", label: "Failed", color: "var(--destructive)" },
] as const;

export function OutcomesChart({ data, height = 240 }: { data: TimeseriesPoint[]; height?: number }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4" role="list" aria-label="Legend">
        {OUTCOMES.map((item) => (
          <span key={item.key} role="listitem" className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="size-2.5 rounded-[3px]" style={{ background: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
      <div style={{ height }} role="img" aria-label="Daily outbound message outcomes: delivered, blocked by policy, failed">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={shortDate} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={24} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={44} />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.6 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
                    <div className="mb-1 font-medium">{shortDate(String(label))}</div>
                    {OUTCOMES.map((item) => (
                      <div key={item.key} className="flex items-center gap-2 text-muted-foreground">
                        <span className="size-2 rounded-[2px]" style={{ background: item.color }} />
                        <span className="flex-1">{item.label}</span>
                        <span className="font-medium tabular-nums text-foreground">{String(payload.find((entry) => entry.dataKey === item.key)?.value ?? 0)}</span>
                      </div>
                    ))}
                  </div>
                ) : null
              }
            />
            {OUTCOMES.map((item, index) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.label}
                stackId="outcomes"
                fill={item.color}
                stroke="var(--card)"
                strokeWidth={2}
                radius={index === OUTCOMES.length - 1 ? [4, 4, 0, 0] : 0}
                maxBarSize={28}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
