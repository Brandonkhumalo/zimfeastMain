import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/apiRequest";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, X } from "lucide-react";
import PageHeader from "./components/PageHeader";
import StatusBadge from "./components/StatusBadge";
import DataTable, { type ColumnDef } from "./components/DataTable";
import ExportButton from "./components/ExportButton";
import type { ExportColumn } from "@/lib/exportUtils";

// ── Types (matching exact API response) ─────────────────────────────────────

interface Order {
  id: string;
  restaurant_names: string;
  customer_id: string;
  status: string;
  method: string;
  total_fee: number;
  created: string;
}

interface OrderSearchResponse {
  results: Order[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
  { value: "all", label: "All Statuses" },
  { value: "pending_payment", label: "Pending Payment" },
  { value: "paid", label: "Paid" },
  { value: "preparing", label: "Preparing" },
  { value: "ready", label: "Ready" },
  { value: "collected", label: "Collected" },
  { value: "assigned", label: "Assigned" },
  { value: "out_for_delivery", label: "Out for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const PAGE_SIZES = [10, 25, 50];

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const [, navigate] = useLocation();

  // Filter state
  const [status, setStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Build query string from filter state
  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (searchQuery.trim()) params.set("q", searchQuery.trim());
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    return params.toString();
  }, [status, searchQuery, dateFrom, dateTo, page, pageSize]);

  // Fetch orders with filters
  const {
    data: orderData,
    isLoading,
    isFetching,
  } = useQuery<OrderSearchResponse>({
    queryKey: ["admin-orders-search", status, searchQuery, dateFrom, dateTo, page, pageSize],
    queryFn: () =>
      apiRequest<OrderSearchResponse>(`/api/orders/admin/search/?${buildQueryString()}`),
    placeholderData: (prev) => prev,
  });

  const orders = orderData?.results ?? [];
  const totalItems = orderData?.count ?? 0;

  // Clear all filters
  function clearFilters() {
    setStatus("all");
    setSearchQuery("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }

  const hasActiveFilters =
    status !== "all" || searchQuery.trim() !== "" || dateFrom !== "" || dateTo !== "";

  // Reset to page 1 when any filter changes
  function handleFilterChange(setter: (val: string) => void) {
    return (val: string) => {
      setter(val);
      setPage(1);
    };
  }

  // ── Table columns ────────────────────────────────────────────────────────

  const columns: ColumnDef<Order>[] = [
    {
      key: "id",
      header: "Order ID",
      cell: (order) => (
        <span className="font-mono text-xs text-muted-foreground">
          {order.id.slice(0, 8)}...
        </span>
      ),
      className: "w-[120px]",
    },
    {
      key: "restaurant_names",
      header: "Restaurant",
      cell: (order) => (
        <span className="text-sm font-medium max-w-[200px] truncate block">
          {order.restaurant_names || "N/A"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (order) => <StatusBadge status={order.status} />,
    },
    {
      key: "method",
      header: "Method",
      cell: (order) => (
        <span className="text-sm capitalize text-muted-foreground">
          {order.method || "N/A"}
        </span>
      ),
      className: "hidden lg:table-cell",
    },
    {
      key: "total_fee",
      header: "Amount",
      sortable: true,
      cell: (order) => (
        <span className="text-sm font-semibold tabular-nums">
          {formatCurrency(order.total_fee)}
        </span>
      ),
      className: "text-right",
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      cell: (order) => (
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{formatRelativeTime(order.created)}</p>
          <p className="text-[10px] text-muted-foreground/60 hidden xl:block">
            {formatDate(order.created)}
          </p>
        </div>
      ),
      className: "text-right",
    },
    {
      key: "actions",
      header: "",
      cell: (order) => (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/admin/orders/${order.id}`);
          }}
        >
          Details
        </Button>
      ),
      className: "w-[80px]",
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Orders"
        description="Search, filter, and manage all platform orders."
      />

      {/* ── Filter Bar ─────────────────────────────────────────────────── */}
      <Card className="shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            {/* Status */}
            <div className="space-y-1 lg:w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select value={status} onValueChange={handleFilterChange(setStatus)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORDER_STATUSES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-1 lg:w-[170px]">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input
                type="date"
                className="h-9"
                value={dateFrom}
                onChange={(e) => handleFilterChange(setDateFrom)(e.target.value)}
              />
            </div>

            {/* Date To */}
            <div className="space-y-1 lg:w-[170px]">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input
                type="date"
                className="h-9"
                value={dateTo}
                onChange={(e) => handleFilterChange(setDateTo)(e.target.value)}
              />
            </div>

            {/* Search */}
            <div className="space-y-1 flex-1 lg:min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by restaurant or order ID..."
                  className="h-9 pl-9"
                  value={searchQuery}
                  onChange={(e) => handleFilterChange(setSearchQuery)(e.target.value)}
                />
              </div>
            </div>

            {/* Page Size */}
            <div className="space-y-1 lg:w-[100px]">
              <label className="text-xs font-medium text-muted-foreground">Per page</label>
              <Select
                value={String(pageSize)}
                onValueChange={(val) => {
                  setPageSize(Number(val));
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9 text-xs text-muted-foreground"
                onClick={clearFilters}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Clear
              </Button>
            )}
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3 pt-3 border-t">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              {status !== "all" && (
                <span className="inline-flex items-center rounded-full bg-orange-100 text-orange-800 px-2 py-0.5 text-[10px] font-medium">
                  Status: {ORDER_STATUSES.find((s) => s.value === status)?.label}
                  <button onClick={() => setStatus("all")} className="ml-1 hover:text-orange-600">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
              {searchQuery.trim() && (
                <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-medium">
                  Search: "{searchQuery}"
                  <button onClick={() => setSearchQuery("")} className="ml-1 hover:text-blue-600">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-[10px] font-medium">
                  From: {dateFrom}
                  <button onClick={() => setDateFrom("")} className="ml-1 hover:text-purple-600">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-[10px] font-medium">
                  To: {dateTo}
                  <button onClick={() => setDateTo("")} className="ml-1 hover:text-purple-600">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Results summary + Export ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {isLoading ? (
            <Skeleton className="h-4 w-40 inline-block" />
          ) : (
            <>
              {totalItems.toLocaleString()} order{totalItems !== 1 ? "s" : ""} found
              {isFetching && !isLoading && (
                <span className="ml-2 text-xs text-orange-500">Updating...</span>
              )}
            </>
          )}
        </p>
        <ExportButton
          data={orders}
          columns={[
            { key: "id", header: "Order ID" },
            { key: "restaurant_names", header: "Restaurant" },
            { key: "status", header: "Status" },
            { key: "method", header: "Method" },
            { key: "total_fee", header: "Amount", transform: (v) => Number(v).toFixed(2) },
            { key: "created", header: "Created", transform: (v) => new Date(v).toLocaleString() },
          ] as ExportColumn[]}
          filename={`zimfeast-orders-${new Date().toISOString().slice(0, 10)}`}
        />
      </div>

      {/* ── Orders Table ───────────────────────────────────────────────── */}
      <DataTable<Order>
        columns={columns}
        data={orders}
        rowKey={(order) => order.id}
        isLoading={isLoading}
        loadingRows={pageSize > 10 ? 10 : pageSize}
        onRowClick={(order) => navigate(`/admin/orders/${order.id}`)}
        totalItems={totalItems}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        emptyMessage={
          hasActiveFilters
            ? "No orders match your filters. Try adjusting your search criteria."
            : "No orders found."
        }
      />
    </div>
  );
}
