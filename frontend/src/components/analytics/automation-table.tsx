import Link from "next/link";
import { StatusBadge } from "@/components/app/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface AutomationStat {
  id: number;
  name: string;
  status: string;
  trigger_type: string;
  runs: number;
  completed: number;
  failed: number;
  waiting: number;
  success_rate: number | null;
}

export function AutomationTable({ rows }: { rows: AutomationStat[] }) {
  if (rows.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-muted-foreground">No automations yet.</p>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="pl-5">Automation</TableHead>
          <TableHead className="text-right">Runs</TableHead>
          <TableHead className="text-right">Completed</TableHead>
          <TableHead className="text-right">Waiting</TableHead>
          <TableHead className="text-right">Failed</TableHead>
          <TableHead className="w-[180px] pr-5">Success rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            <TableCell className="pl-5">
              <Link href={`/automations/${row.id}`} className="font-medium hover:text-brand">{row.name}</Link>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={row.status} />
                <span>{row.trigger_type.replace(/_/g, " ")}</span>
              </div>
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.runs}</TableCell>
            <TableCell className="text-right tabular-nums">{row.completed}</TableCell>
            <TableCell className="text-right tabular-nums">{row.waiting}</TableCell>
            <TableCell className={row.failed > 0 ? "text-right tabular-nums text-destructive" : "text-right tabular-nums"}>{row.failed}</TableCell>
            <TableCell className="pr-5">
              {row.success_rate === null ? (
                <span className="text-xs text-muted-foreground">No runs</span>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="presentation">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${row.success_rate}%` }} />
                  </div>
                  <span className="w-11 text-right text-xs font-medium tabular-nums">{row.success_rate}%</span>
                </div>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
