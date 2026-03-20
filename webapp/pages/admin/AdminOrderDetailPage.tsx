import { useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Clock,
  MapPin,
  User,
  Store,
  Truck,
  AlertTriangle,
  RotateCcw,
  Package,
  ChevronRight,
} from "lucide-react";
import PageHeader from "./components/PageHeader";
import StatusBadge from "./components/StatusBadge";

// ── Types (matching exact API response) ─────────────────────────────────────

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes?: string;
}

interface StatusTransition {
  status: string;
  timestamp: string;
  actor?: string;
}

interface OrderDetail {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  restaurant_id: string;
  restaurant_name: string;
  driver_id?: string;
  driver_name?: string;
  driver_phone?: string;
  status: string;
  method: string;
  subtotal: number;
  delivery_fee: number;
  service_fee: number;
  tip?: number;
  total_fee: number;
  delivery_address: string;
  delivery_lat?: number;
  delivery_lng?: number;
  special_instructions?: string;
  items: OrderItem[];
  status_history: StatusTransition[];
  created: string;
  updated: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** The full lifecycle of order statuses in order */
const STATUS_FLOW = [
  "pending_payment",
  "paid",
  "preparing",
  "ready",
  "collected",
  "assigned",
  "out_for_delivery",
  "delivered",
];

/** All possible statuses an admin can force-set */
const OVERRIDE_STATUSES = [
  { value: "paid", label: "Paid" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "collected", label: "Collected" },
  { value: "assigned", label: "Assigned" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

/** Get step index for a status in the flow (for the visual timeline) */
function getStatusIndex(status: string): number {
  const idx = STATUS_FLOW.indexOf(status);
  return idx >= 0 ? idx : -1;
}

// ── Timeline Step Component ─────────────────────────────────────────────────

function TimelineStep({
  status,
  timestamp,
  actor,
  isCompleted,
  isCurrent,
  isLast,
}: {
  status: string;
  timestamp?: string;
  actor?: string;
  isCompleted: boolean;
  isCurrent: boolean;
  isLast: boolean;
}) {
  return (
    <div className="flex gap-3">
      {/* Dot + connecting line */}
      <div className="flex flex-col items-center">
        <div
          className={`w-3 h-3 rounded-full border-2 flex-shrink-0 ${
            isCurrent
              ? "border-orange-500 bg-orange-500 ring-4 ring-orange-500/20"
              : isCompleted
                ? "border-emerald-500 bg-emerald-500"
                : "border-muted-foreground/30 bg-background"
          }`}
        />
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-[32px] ${
              isCompleted ? "bg-emerald-500" : "bg-muted-foreground/20"
            }`}
          />
        )}
      </div>
      {/* Content */}
      <div className="pb-5 -mt-0.5">
        <p
          className={`text-sm font-medium capitalize ${
            isCurrent
              ? "text-orange-600"
              : isCompleted
                ? "text-foreground"
                : "text-muted-foreground"
          }`}
        >
          {status.replace(/_/g, " ")}
        </p>
        {timestamp && (
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {formatDateTime(timestamp)}
          </p>
        )}
        {actor && (
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">by {actor}</p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  // Status override state
  const [overrideStatus, setOverrideStatus] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideConfirmOpen, setOverrideConfirmOpen] = useState(false);

  // Refund dialog state
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  // ── Fetch order detail ───────────────────────────────────────────────────

  const {
    data: order,
    isLoading,
    isError,
  } = useQuery<OrderDetail>({
    queryKey: ["admin-order-detail", id],
    queryFn: () => apiRequest<OrderDetail>(`/api/orders/admin/order/${id}/`),
    enabled: !!id,
    refetchInterval: 15_000,
  });

  // ── Mutations ────────────────────────────────────────────────────────────

  // Status override: PATCH /api/orders/admin/order/{id}/override-status/
  const overrideMutation = useMutation({
    mutationFn: (payload: { status: string; reason: string }) =>
      apiRequest(`/api/orders/admin/order/${id}/override-status/`, "PATCH", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["admin-orders-search"] });
      setOverrideConfirmOpen(false);
      setOverrideStatus("");
      setOverrideReason("");
    },
  });

  // Refund mutation
  const refundMutation = useMutation({
    mutationFn: () =>
      apiRequest("/api/payments/admin/refund/", "POST", {
        order_id: id,
        amount: parseFloat(refundAmount),
        reason: refundReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-order-detail", id] });
      setRefundOpen(false);
      setRefundAmount("");
      setRefundReason("");
    },
  });

  // ── Build the visual timeline ────────────────────────────────────────────

  const historyMap = new Map<string, StatusTransition>();
  order?.status_history?.forEach((t) => {
    historyMap.set(t.status, t);
  });

  const currentStatusIndex = order ? getStatusIndex(order.status) : -1;
  const isCancelled = order?.status === "cancelled";

  // ── Render: Loading state ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-7 w-48" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-48 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
          <Skeleton className="h-96 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // ── Render: Error / Not Found state ──────────────────────────────────────

  if (isError || !order) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Order Not Found"
          description="The requested order could not be loaded."
          actions={
            <Link href="/admin/orders">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Orders
              </Button>
            </Link>
          }
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <AlertTriangle className="h-10 w-10 text-amber-500 mb-3" />
            <p className="text-sm text-muted-foreground">
              Could not find order with ID: {id}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/admin/orders")}>
              Go to Orders
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render: Order Detail ─────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title={`Order #${order.id.slice(0, 8)}...`}
        description={`Created ${formatRelativeTime(order.created)} -- ${formatDateTime(order.created)}`}
        actions={
          <Link href="/admin/orders">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Back to Orders
            </Button>
          </Link>
        }
      />

      {/* Status + Total + Method banner */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-lg bg-muted/40 border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Status:</span>
          <StatusBadge status={order.status} />
        </div>
        <div className="h-5 w-px bg-border hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Total:</span>
          <span className="text-lg font-bold">{formatCurrency(order.total_fee)}</span>
        </div>
        <div className="h-5 w-px bg-border hidden sm:block" />
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Created:</span>
          <span className="text-sm">{formatDateTime(order.created)}</span>
        </div>
      </div>

      {/* ── Main 3-column grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT: Details + Items + Fees + Actions (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Details Grid */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Order Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <User className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Customer</p>
                  <p className="text-sm font-medium">{order.customer_name || "N/A"}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.customer_email || ""}{" "}
                    {order.customer_phone ? ` / ${order.customer_phone}` : ""}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                    ID: {order.customer_id}
                  </p>
                </div>
              </div>

              {/* Restaurant */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <Store className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Restaurant</p>
                  <p className="text-sm font-medium">{order.restaurant_name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                    ID: {order.restaurant_id}
                  </p>
                </div>
              </div>

              {/* Driver (if assigned) */}
              {order.driver_id && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Truck className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-muted-foreground">Driver</p>
                    <p className="text-sm font-medium">{order.driver_name || "Assigned"}</p>
                    {order.driver_phone && (
                      <p className="text-xs text-muted-foreground">{order.driver_phone}</p>
                    )}
                    <p className="text-[10px] font-mono text-muted-foreground/60 mt-0.5">
                      ID: {order.driver_id}
                    </p>
                  </div>
                </div>
              )}

              {/* Delivery Address */}
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Delivery Address</p>
                  <p className="text-sm">{order.delivery_address || "No address provided"}</p>
                </div>
              </div>

              {/* Special Instructions */}
              {order.special_instructions && (
                <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <Package className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-amber-700">Special Instructions</p>
                    <p className="text-sm text-amber-800 mt-0.5">{order.special_instructions}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Items List + Fee Breakdown */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Items ({order.items?.length ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(!order.items || order.items.length === 0) ? (
                <p className="text-sm text-muted-foreground text-center py-6">No items found</p>
              ) : (
                <div className="space-y-2">
                  {order.items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-7 h-7 rounded-full bg-orange-100 text-orange-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                          {item.quantity}x
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.name}</p>
                          {item.notes && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                              {item.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(item.total_price)}
                        </p>
                        {item.quantity > 1 && (
                          <p className="text-[10px] text-muted-foreground">
                            {formatCurrency(item.unit_price)} each
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Fee breakdown */}
                  <div className="border-t pt-3 mt-3 space-y-1.5 px-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">{formatCurrency(order.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Delivery Fee</span>
                      <span className="tabular-nums">{formatCurrency(order.delivery_fee)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Service Fee</span>
                      <span className="tabular-nums">{formatCurrency(order.service_fee)}</span>
                    </div>
                    {order.tip != null && order.tip > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tip</span>
                        <span className="tabular-nums">{formatCurrency(order.tip)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold border-t pt-2 mt-2">
                      <span>Total</span>
                      <span className="tabular-nums">{formatCurrency(order.total_fee)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Admin Actions Card ─────────────────────────────────────── */}
          <Card className="shadow-sm border-orange-200 bg-orange-50/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                Admin Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status Override */}
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  Override Order Status
                </label>
                <div className="flex gap-2">
                  <Select value={overrideStatus} onValueChange={setOverrideStatus}>
                    <SelectTrigger className="bg-background flex-1">
                      <SelectValue placeholder="Select new status..." />
                    </SelectTrigger>
                    <SelectContent>
                      {OVERRIDE_STATUSES.filter((s) => s.value !== order.status).map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {/* Reason textarea */}
                <Textarea
                  placeholder="Reason for override..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  rows={2}
                  className="bg-background"
                />
                <Button
                  variant="default"
                  disabled={!overrideStatus || !overrideReason.trim() || overrideMutation.isPending}
                  onClick={() => setOverrideConfirmOpen(true)}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {overrideMutation.isPending ? "Updating..." : "Override Status"}
                </Button>
                {overrideMutation.isError && (
                  <p className="text-xs text-red-600">
                    Failed to update status. Please try again.
                  </p>
                )}
              </div>

              {/* Refund */}
              <div className="border-t pt-4">
                <Button
                  variant="outline"
                  className="border-red-300 text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setRefundAmount(String(order.total_fee));
                    setRefundOpen(true);
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Issue Refund
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* RIGHT: Timeline + Quick Info (1 col) */}
        <div className="space-y-6">
          {/* Timeline */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-semibold">Order Timeline</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {isCancelled ? (
                // Show history then cancelled
                <div>
                  {(order.status_history ?? []).map((transition, idx) => (
                    <TimelineStep
                      key={transition.status + idx}
                      status={transition.status}
                      timestamp={transition.timestamp}
                      actor={transition.actor}
                      isCompleted={true}
                      isCurrent={false}
                      isLast={false}
                    />
                  ))}
                  <TimelineStep
                    status="cancelled"
                    timestamp={order.updated}
                    isCompleted={false}
                    isCurrent={true}
                    isLast={true}
                  />
                </div>
              ) : (
                // Normal flow: show all steps
                <div>
                  {STATUS_FLOW.map((statusKey, idx) => {
                    const transition = historyMap.get(statusKey);
                    const isCompleted = idx < currentStatusIndex;
                    const isCurrent = idx === currentStatusIndex;
                    const isLast = idx === STATUS_FLOW.length - 1;

                    return (
                      <TimelineStep
                        key={statusKey}
                        status={statusKey}
                        timestamp={transition?.timestamp}
                        actor={transition?.actor}
                        isCompleted={isCompleted}
                        isCurrent={isCurrent}
                        isLast={isLast}
                      />
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Info */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Order ID</span>
                <span className="font-mono text-xs">{order.id}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Payment</span>
                <span className="capitalize">{order.method || "N/A"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Created</span>
                <span className="text-xs">{formatDateTime(order.created)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Updated</span>
                <span className="text-xs">{formatDateTime(order.updated)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Status Override Confirm Dialog ──────────────────────────────── */}
      <Dialog open={overrideConfirmOpen} onOpenChange={setOverrideConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Status Override</DialogTitle>
            <DialogDescription>
              You are about to change this order's status from{" "}
              <strong className="capitalize">{order.status.replace(/_/g, " ")}</strong> to{" "}
              <strong className="capitalize">{overrideStatus.replace(/_/g, " ")}</strong>.
              This action will be logged.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center gap-3 py-4">
            <StatusBadge status={order.status} />
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <StatusBadge status={overrideStatus} />
          </div>
          <div className="px-1">
            <p className="text-xs text-muted-foreground mb-1">Reason:</p>
            <p className="text-sm bg-muted/50 rounded p-2">{overrideReason}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverrideConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              disabled={overrideMutation.isPending}
              onClick={() =>
                overrideMutation.mutate({
                  status: overrideStatus,
                  reason: overrideReason,
                })
              }
            >
              {overrideMutation.isPending ? "Updating..." : "Confirm Override"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Refund Dialog ──────────────────────────────────────────────── */}
      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Refund</DialogTitle>
            <DialogDescription>
              Issue a voucher refund for order #{order.id.slice(0, 8)}...
              The customer will receive a voucher credit.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Refund Amount ($)</label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={order.total_fee}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="0.00"
              />
              <p className="text-[11px] text-muted-foreground">
                Order total: {formatCurrency(order.total_fee)}
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Reason</label>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Explain why this refund is being issued..."
                rows={3}
              />
            </div>
            {refundMutation.isError && (
              <p className="text-xs text-red-600">
                Failed to issue refund. Please try again.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={
                refundMutation.isPending ||
                !refundAmount ||
                parseFloat(refundAmount) <= 0 ||
                !refundReason.trim()
              }
              onClick={() => refundMutation.mutate()}
            >
              {refundMutation.isPending
                ? "Processing..."
                : `Refund ${formatCurrency(parseFloat(refundAmount) || 0)}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
