"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { shortDate } from "@/lib/format";
import type { TimeseriesPoint } from "@/lib/types";

export interface Series {
  key: keyof TimeseriesPoint;
  label: string;
  /** CSS variable holding the series color, e.g. "--chart-1". */
  color: string;
}

/**
 * Daily activity on one shared axis (counts only — never a second y-scale).
 * Thin 2px lines, light fills, crosshair tooltip, legend for 2+ series.
 */
export function ActivityChart({ data, series, height = 260 }: { data: TimeseriesPoint[]; series: Series[]; height?: number }) {
  return (
    <div>
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-4" role="list" aria-label="Legend">
          {series.map((item) => (
            <span key={item.key} role="listitem" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-0.5 w-3.5 rounded-full" style={{ background: `var(${item.color})` }} />
              {item.label}
            </span>
          ))}
        </div>
      )}
      <div style={{ height }} role="img" aria-label={`Daily ${series.map((item) => item.label).join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <defs>
              {series.map((item) => (
                <linearGradient key={item.key} id={`fill-${item.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={`var(${item.color})`} stopOpacity={0.16} />
                  <stop offset="100%" stopColor={`var(${item.color})`} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              minTickGap={24}
            />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} width={44} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
                    <div className="mb-1 font-medium">{shortDate(String(label))}</div>
                    {series.map((item) => {
                      const point = payload.find((entry) => entry.dataKey === item.key);
                      return (
                        <div key={item.key} className="flex items-center gap-2 text-muted-foreground">
                          <span className="size-2 rounded-full" style={{ background: `var(${item.color})` }} />
                          <span className="flex-1">{item.label}</span>
                          <span className="font-medium tabular-nums text-foreground">{String(point?.value ?? 0)}</span>
                        </div>
                      );
                    })}
                  </div>
                ) : null
              }
            />
            {series.map((item) => (
              <Area
                key={item.key}
                type="monotone"
                dataKey={item.key}
                name={item.label}
                stroke={`var(${item.color})`}
                strokeWidth={2}
                fill={`url(#fill-${item.key})`}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                dot={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
