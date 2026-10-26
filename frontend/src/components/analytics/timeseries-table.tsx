import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { shortDate } from "@/lib/format";
import type { TimeseriesPoint } from "@/lib/types";

/** Accessible table view of the daily series behind the charts. */
export function TimeseriesTable({ data }: { data: TimeseriesPoint[] }) {
  const columns: { key: keyof TimeseriesPoint; label: string }[] = [
    { key: "comments", label: "Comments" },
    { key: "received", label: "Received" },
    { key: "sent", label: "Delivered" },
    { key: "blocked", label: "Blocked" },
    { key: "failed", label: "Failed" },
    { key: "runs", label: "Runs" },
    { key: "leads", label: "Leads" },
  ];

  return (
    <div className="max-h-[320px] overflow-auto rounded-lg border scrollbar-thin">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead>Date</TableHead>
            {columns.map((column) => <TableHead key={column.key} className="text-right">{column.label}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...data].reverse().map((point) => (
            <TableRow key={point.date}>
              <TableCell>{shortDate(point.date)}</TableCell>
              {columns.map((column) => <TableCell key={column.key} className="text-right tabular-nums">{point[column.key]}</TableCell>)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
