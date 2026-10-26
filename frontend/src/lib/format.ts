import { formatDistanceToNowStrict, format } from "date-fns";

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "—";
  return formatDistanceToNowStrict(new Date(value), { addSuffix: true });
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return format(new Date(value), "MMM d, yyyy · HH:mm");
}

export function shortDate(value: string): string {
  return format(new Date(value), "MMM d");
}

export function compact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/** Percentage change between two periods, or null when there is no baseline. */
export function delta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function initials(name: string): string {
  return name
    .replace(/^@/, "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
