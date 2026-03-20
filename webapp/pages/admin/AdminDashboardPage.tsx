import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/apiRequest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import {
  ShoppingCart,
  DollarSign,
  Clock,
  Users,
  AlertTriangle,
  ExternalLink,
  TrendingUp,
} from "lucide-react";
import StatCard from "./components/StatCard";
import StatusBadge from "./components/StatusBadge";

// ── Types (matching exact API response shapes) ──────────────────────────────

interface LiveStats {
  active_by_status: Record<string, number>;
  orders_last_hour: number;
  avg_delivery_time_min: number;
  stuck_orders: StuckOrder[];
}

interface StuckOrder {
  id: string;
  status: string;
  minutes_stuck: number;
}

interface Analytics {
  today: { order_count: number; revenue: number };
  last_7_days: { order_count: number; revenue: number };
  daily_revenue: Array<{ date: string; revenue: number }>;
  status_breakdown: Record<string, number>;
  top_restaurants: Array<{ name: string; order_count: number; revenue: number }>;
  recent_orders: Array<{
    id: string;
    status: string;
    total_fee: number;
    created: string;
  }>;
}

interface HourlyEntry {
  hour: number;
  today: number;
  yesterday: number;
}

interface UserStats {
  customers: number;
  restaurants: number;
  drivers: number;
  total: number;
}

// ── Status color maps for pie chart ─────────────────────────────────────────

const STATUS_PIE_COLORS: Record<string, string> = {
  pending_payment: "#f59e0b", // amber
  paid: "#3b82f6",           // blue
  preparing: "#8b5cf6",      // purple
  ready: "#06b6d4",          // cyan
  collected: "#14b8a6",      // teal
  assigned: "#6366f1",       // indigo
  out_for_delivery: "#f97316", // orange
  delivered: "#22c55e",      // green
  cancelled: "#ef4444",      // red
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function timeAgo(dateStr: string): string {
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

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

/** Shared custom tooltip for recharts */
function ChartTooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-xl text-foreground">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}: {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
        </p>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function AdminDashboardPage() {
  const [, navigate] = useLocation();

  // ── Data fetching with auto-refresh ──────────────────────────────────────

  const { data: liveStats, isLoading: liveLoading } = useQuery<LiveStats>({
    queryKey: ["admin-live-stats"],
    queryFn: () => apiRequest<LiveStats>("/api/orders/admin/live-stats/"),
    refetchInterval: 30_000,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ["admin-analytics-dashboard"],
    queryFn: () => apiRequest<Analytics>("/api/orders/admin/analytics/"),
    refetchInterval: 30_000,
  });

  const { data: hourlyData, isLoading: hourlyLoading } = useQuery<HourlyEntry[]>({
    queryKey: ["admin-hourly"],
    queryFn: () => apiRequest<HourlyEntry[]>("/api/orders/admin/hourly/"),
    refetchInterval: 30_000,
  });

  const { data: userStats, isLoading: userStatsLoading } = useQuery<UserStats>({
    queryKey: ["admin-user-stats"],
    queryFn: () => apiRequest<UserStats>("/api/accounts/admin/stats/"),
    refetchInterval: 30_000,
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  // Sum all active order statuses
  const activeOrderCount = liveStats?.active_by_status
    ? Object.values(liveStats.active_by_status).reduce((sum, n) => sum + n, 0)
    : 0;

  const revenueToday = analytics?.today?.revenue ?? 0;
  const avgDeliveryTime = liveStats?.avg_delivery_time_min ?? 0;
  const onlineUsers = userStats?.total ?? 0;

  // Hourly chart data: merge the array into a chart-friendly format
  const hourlyChartData = Array.from({ length: 24 }, (_, i) => {
    const entry = hourlyData?.find((h) => h.hour === i);
    return {
      hour: formatHour(i),
      Today: entry?.today ?? 0,
      Yesterday: entry?.yesterday ?? 0,
    };
  });

  // Pie chart data from status breakdown
  const statusPieData = analytics?.status_breakdown
    ? Object.entries(analytics.status_breakdown)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({
          name: name.replace(/_/g, " "),
          value,
          fill: STATUS_PIE_COLORS[name] || "#71717a",
        }))
    : [];

  // Top restaurants horizontal bar data
  const topRestaurantsData = (analytics?.top_restaurants ?? []).slice(0, 10).map((r) => ({
    name:
      r.name && r.name.length > 22
        ? r.name.slice(0, 22) + "..."
        : r.name || "Unknown",
    orders: r.order_count,
    revenue: r.revenue,
  }));

  // Stuck orders for the alerts panel
  const stuckOrders = liveStats?.stuck_orders ?? [];

  // Recent orders
  const recentOrders = (analytics?.recent_orders ?? []).slice(0, 20);

  // ── Loading helpers ──────────────────────────────────────────────────────

  const isStatLoading = liveLoading || analyticsLoading || userStatsLoading;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Operations</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time platform overview &mdash; auto-refreshes every 30 seconds
          </p>
        </div>
        <div className="flex items-center gap-2 mt-3 sm:mt-0">
          <div className="flex items-center gap-1.5 rounded-full bg-green-500/10 px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            <span className="text-xs font-medium text-green-600">Live</span>
          </div>
        </div>
      </div>

      {/* ── Row 1: 4 StatCards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {isStatLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-20 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Active Orders"
              value={activeOrderCount}
              subtitle={`${liveStats?.orders_last_hour ?? 0} in last hour`}
              icon={ShoppingCart}
              color="orange"
            />
            <StatCard
              title="Revenue Today"
              value={formatCurrency(revenueToday)}
              icon={DollarSign}
              color="green"
            />
            <StatCard
              title="Avg Delivery Time"
              value={`${avgDeliveryTime} min`}
              subtitle="Order to delivered"
              icon={Clock}
              color="blue"
            />
            <StatCard
              title="Online Users"
              value={onlineUsers}
              subtitle={`${userStats?.customers ?? 0} customers, ${userStats?.drivers ?? 0} drivers`}
              icon={Users}
              color="purple"
            />
          </>
        )}
      </div>

      {/* ── Row 2: Charts (2 columns) ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Orders Per Hour AreaChart */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Orders Per Hour</CardTitle>
            <p className="text-xs text-muted-foreground">Today vs Yesterday</p>
          </CardHeader>
          <CardContent>
            {hourlyLoading ? (
              <Skeleton className="h-[280px] w-full rounded-md" />
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyChartData}>
                    <defs>
                      <linearGradient id="gradToday" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradYesterday" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                      interval={2}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 10 }}
                      className="text-muted-foreground"
                      tickLine={false}
                      axisLine={false}
                      width={30}
                    />
                    <Tooltip content={<ChartTooltipContent />} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
                    <Area
                      type="monotone"
                      dataKey="Yesterday"
                      stroke="#94a3b8"
                      strokeWidth={1.5}
                      strokeDasharray="5 5"
                      fill="url(#gradYesterday)"
                    />
                    <Area
                      type="monotone"
                      dataKey="Today"
                      stroke="#f97316"
                      strokeWidth={2.5}
                      fill="url(#gradToday)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT: Order Status PieChart */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Status Distribution</CardTitle>
            <p className="text-xs text-muted-foreground">Current order breakdown</p>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <Skeleton className="h-[280px] w-full rounded-md" />
            ) : statusPieData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
                No order data available
              </div>
            ) : (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) =>
                        percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                      }
                      labelLine={{ strokeWidth: 1 }}
                    >
                      {statusPieData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} strokeWidth={0} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltipContent />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Recent Orders (60%) + Alerts (40%) ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* LEFT (60%): Recent Orders table */}
        <Card className="lg:col-span-3 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">Recent Orders</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">Last 20 orders across the platform</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8"
                onClick={() => navigate("/admin/orders")}
              >
                View All <ExternalLink className="h-3 w-3 ml-1.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {analyticsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
              </div>
            ) : (
              <div className="overflow-auto max-h-[420px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs font-medium">Order ID</TableHead>
                      <TableHead className="text-xs font-medium">Status</TableHead>
                      <TableHead className="text-xs font-medium text-right">Amount</TableHead>
                      <TableHead className="text-xs font-medium text-right">Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        className="cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                      >
                        <TableCell className="font-mono text-xs py-2.5">
                          {order.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="py-2.5">
                          <StatusBadge status={order.status} />
                        </TableCell>
                        <TableCell className="text-sm font-medium text-right py-2.5 tabular-nums">
                          {formatCurrency(order.total_fee)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground text-right py-2.5 whitespace-nowrap">
                          {timeAgo(order.created)}
                        </TableCell>
                      </TableRow>
                    ))}
                    {recentOrders.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-12">
                          No recent orders
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* RIGHT (40%): Alerts panel — stuck orders */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${stuckOrders.length > 0 ? "text-amber-500" : "text-green-500"}`} />
              <CardTitle className="text-base font-semibold">Alerts</CardTitle>
              {stuckOrders.length > 0 && (
                <span className="ml-auto inline-flex items-center rounded-full bg-amber-100 text-amber-800 px-2 py-0.5 text-[10px] font-medium border border-amber-200">
                  {stuckOrders.length}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Stuck orders requiring attention</p>
          </CardHeader>
          <CardContent className="pt-0 space-y-2.5 overflow-auto max-h-[420px]">
            {stuckOrders.length === 0 && (
              <div className="text-center py-10">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-3">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-sm font-medium text-green-700">All Clear</p>
                <p className="text-xs text-muted-foreground mt-1">No stuck orders right now</p>
              </div>
            )}

            {stuckOrders.map((order) => {
              // Over 30 min stuck is critical (red), otherwise warning (amber)
              const isCritical = order.minutes_stuck > 30;
              return (
                <div
                  key={order.id}
                  className={`rounded-lg border p-3 transition-colors ${
                    isCritical
                      ? "border-red-200 bg-red-50"
                      : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle
                          className={`h-3.5 w-3.5 flex-shrink-0 ${
                            isCritical ? "text-red-500" : "text-amber-500"
                          }`}
                        />
                        <span className="text-xs font-semibold capitalize">
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {order.id.slice(0, 8)}...
                        </span>
                        <span
                          className={`text-[10px] font-semibold ${
                            isCritical ? "text-red-600" : "text-amber-600"
                          }`}
                        >
                          {order.minutes_stuck}m stuck
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] px-2.5 flex-shrink-0"
                      onClick={() => navigate(`/admin/orders/${order.id}`)}
                    >
                      View
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Top Restaurants horizontal BarChart ──────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">Top Restaurants</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">By order count (current period)</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-8"
              onClick={() => navigate("/admin/restaurants")}
            >
              All Restaurants <ExternalLink className="h-3 w-3 ml-1.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {analyticsLoading ? (
            <Skeleton className="h-[340px] w-full rounded-md" />
          ) : topRestaurantsData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
              No restaurant data available
            </div>
          ) : (
            <div className="h-[340px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={topRestaurantsData}
                  layout="vertical"
                  margin={{ left: 10, right: 30, top: 5, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted/50" />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    className="text-muted-foreground"
                    width={160}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-xl text-foreground">
                          <p className="text-sm font-semibold">{data.name}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{data.orders} orders</span>
                            <span>{formatCurrency(data.revenue)} revenue</span>
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="orders" fill="#f97316" radius={[0, 6, 6, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
