import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Maps various status strings to color classes.
 * Covers order statuses, user statuses, driver statuses, payment statuses, etc.
 */
const statusColorMap: Record<string, string> = {
  // Order statuses
  pending_payment: "bg-yellow-100 text-yellow-800 border-yellow-200",
  paid: "bg-blue-100 text-blue-800 border-blue-200",
  preparing: "bg-indigo-100 text-indigo-800 border-indigo-200",
  ready: "bg-cyan-100 text-cyan-800 border-cyan-200",
  collected: "bg-teal-100 text-teal-800 border-teal-200",
  assigned: "bg-purple-100 text-purple-800 border-purple-200",
  out_for_delivery: "bg-orange-100 text-orange-800 border-orange-200",
  delivered: "bg-emerald-100 text-emerald-800 border-emerald-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  refunded: "bg-rose-100 text-rose-800 border-rose-200",

  // User / general statuses
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  inactive: "bg-zinc-100 text-zinc-800 border-zinc-200",
  suspended: "bg-red-100 text-red-800 border-red-200",
  banned: "bg-red-200 text-red-900 border-red-300",
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejected: "bg-red-100 text-red-800 border-red-200",

  // Driver statuses
  online: "bg-emerald-100 text-emerald-800 border-emerald-200",
  offline: "bg-zinc-100 text-zinc-800 border-zinc-200",
  on_delivery: "bg-blue-100 text-blue-800 border-blue-200",
  busy: "bg-orange-100 text-orange-800 border-orange-200",

  // Payment statuses
  completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
  failed: "bg-red-100 text-red-800 border-red-200",
  processing: "bg-blue-100 text-blue-800 border-blue-200",

  // Restaurant statuses
  open: "bg-emerald-100 text-emerald-800 border-emerald-200",
  closed: "bg-zinc-100 text-zinc-800 border-zinc-200",

  // Promo statuses
  expired: "bg-red-100 text-red-800 border-red-200",
  depleted: "bg-yellow-100 text-yellow-800 border-yellow-200",
  scheduled: "bg-blue-100 text-blue-800 border-blue-200",
};

const defaultColor = "bg-zinc-100 text-zinc-800 border-zinc-200";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

/** Formats a status string for display: "out_for_delivery" → "Out For Delivery" */
function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClasses = statusColorMap[status.toLowerCase()] ?? defaultColor;

  return (
    <Badge
      variant="outline"
      className={cn("font-medium border", colorClasses, className)}
    >
      {formatStatus(status)}
    </Badge>
  );
}
