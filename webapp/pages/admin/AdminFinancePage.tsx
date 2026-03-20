import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Percent,
  CreditCard,
  AlertTriangle,
} from "lucide-react";
import PageHeader from "./components/PageHeader";
import StatCard from "./components/StatCard";

// ── Types (matching exact API response shapes) ──────────────────────────────

interface FinanceSummary {
  total_revenue: number;
  this_month: number;
  this_week: number;
  today: number;
  by_method: Record<string, number>;
  platform_fees: number;
  avg_order_value: number;
  failed_count: number;
}

interface DailyRevenue {
  date: string;
  revenue: number;
}

interface Analytics {
  today: { order_count: number; revenue: number };
  last_7_days: { order_count: number; revenue: number };
  daily_revenue: DailyRevenue[];
  status_breakdown: Record<string, number>;
  top_restaurants: Array<{ name: string; order_count: number; revenue: number }>;
  recent_orders: Array<{
    id: string;
    status: string;
    total_fee: number;
    created: string;
  }>;
}

interface FailedPayment {
  id: string;
  order_id: string;
  amount: number;
  method: string;
  created_at: string;
}

interface Settlement {
  restaurant_id: string;
  total_orders: number;
  total_amount: number;
  platform_fees: number;
}

// ── Payment method colors for pie chart ─────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  paynow: "#3b82f6",   // blue
  voucher: "#8b5cf6",   // purple
  direct: "#22c55e",    // green
  combined: "#f97316",  // orange
};

const METHOD_FALLBACK_COLOR = "#71717a";

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Custom tooltip for ComposedChart (revenue + orders) */
function RevenueChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-xl text-foreground">
      <p className="text-xs font-medium text-muted-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: entry.color }}>
          {entry.name}:{" "}
          {entry.name === "Revenue"
            ? formatCurrency(entry.value)
            : entry.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

/** Custom tooltip for PieChart */
function PieTooltipContent({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const entry = payload[0];
  return (
    <div className="rounded-lg border bg-background/95 backdrop-blur-sm px-3 py-2 shadow-xl text-foreground">
      <p className="text-sm font-semibold capitalize" style={{ color: entry.payload.fill }}>
        {entry.name}: {formatCurrency(entry.value)}
      </p>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function AdminFinancePage() {
  // ── Data fetching with auto-refresh ──────────────────────────────────────

  const { data: finance, isLoading: financeLoading } = useQuery<FinanceSummary>({
    queryKey: ["admin-finance-summary"],
    queryFn: () => apiRequest<FinanceSummary>("/api/payments/admin/finance-summary/"),
    refetchInterval: 30_000,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ["admin-analytics-finance"],
    queryFn: () => apiRequest<Analytics>("/api/orders/admin/analytics/"),
    refetchInterval: 30_000,
  });

  const { data: failedPayments, isLoading: failedLoading } = useQuery<FailedPayment[]>({
    queryKey: ["admin-failed-payments"],
    queryFn: () => apiRequest<FailedPayment[]>("/api/payments/admin/failed-payments/"),
    refetchInterval: 30_000,
  });

  const { data: settlements, isLoading: settlementsLoading } = useQuery<Settlement[]>({
    queryKey: ["admin-settlements"],
    queryFn: () => apiRequest<Settlement[]>("/api/payments/admin/settlements/"),
    refetchInterval: 30_000,
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  // Daily revenue chart data: merge revenue from analytics + order_count (estimated)
  // The analytics endpoint returns daily_revenue[]. We combine with a synthetic order count
  // for the ComposedChart. Since the analytics daily_revenue only has revenue, we derive
  // order count from the ratio of revenue / avg_order_value if available.
  const avgOrderValue = finance?.avg_order_value ?? 0;

  const dailyChartData = (analytics?.daily_revenue ?? [])
    .slice(-30) // last 30 days
    .map((d) => ({
      date: formatShortDate(d.date),
      Revenue: d.revenue,
      Orders: avgOrderValue > 0 ? Math.round(d.revenue / avgOrderValue) : 0,
    }));

  // Payment method breakdown for pie chart
  const methodPieData = finance?.by_method
    ? Object.entries(finance.by_method)
        .filter(([, v]) => v > 0)
        .map(([method, value]) => ({
          name: method.charAt(0).toUpperCase() + method.slice(1),
          value,
          fill: METHOD_COLORS[method.toLowerCase()] || METHOD_FALLBACK_COLOR,
        }))
    : [];

  const isStatLoading = financeLoading;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Finance"
        description="Revenue, payouts, and financial reports."
      />

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
              title="Total Revenue"
              value={formatCurrency(finance?.total_revenue ?? 0)}
              subtitle="All time"
              icon={DollarSign}
              color="green"
            />
            <StatCard
              title="This Month"
              value={formatCurrency(finance?.this_month ?? 0)}
              subtitle={`This week: ${formatCurrency(finance?.this_week ?? 0)}`}
              icon={TrendingUp}
              color="blue"
            />
            <StatCard
              title="Platform Fees"
              value={formatCurrency(finance?.platform_fees ?? 0)}
              subtitle="Commission earned"
              icon={Percent}
              color="orange"
            />
            <StatCard
              title="Avg Order Value"
              value={formatCurrency(finance?.avg_order_value ?? 0)}
              subtitle={`${finance?.failed_count ?? 0} failed payments`}
              icon={CreditCard}
              color="purple"
            />
          </>
        )}
      </div>

      {/* ── Row 2: ComposedChart — Revenue (area) + Orders (bars) ───────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Daily Revenue &amp; Orders</CardTitle>
          <p className="text-xs text-muted-foreground">Last 30 days</p>
        </CardHeader>
        <CardContent>
          {analyticsLoading || financeLoading ? (
            <Skeleton className="h-[320px] w-full rounded-md" />
          ) : dailyChartData.length === 0 ? (
            <div className="h-[320px] flex items-center justify-center text-sm text-muted-foreground">
              No revenue data available
            </div>
          ) : (
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dailyChartData} margin={{ left: 10, right: 10, top: 5, bottom: 5 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    yAxisId="revenue"
                    orientation="left"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    width={60}
                    tickFormatter={(v: number) => `$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
                  />
                  <YAxis
                    yAxisId="orders"
                    orientation="right"
                    tick={{ fontSize: 10 }}
                    className="text-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                    width={40}
                  />
                  <Tooltip content={<RevenueChartTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" iconSize={8} />
                  <Area
                    yAxisId="revenue"
                    type="monotone"
                    dataKey="Revenue"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="url(#gradRevenue)"
                  />
                  <Bar
                    yAxisId="orders"
                    dataKey="Orders"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                    barSize={14}
                    opacity={0.7}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Row 3: Payment Method Breakdown PieChart ───────────────────── */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Payment Method Breakdown</CardTitle>
          <p className="text-xs text-muted-foreground">Revenue by payment method</p>
        </CardHeader>
        <CardContent>
          {financeLoading ? (
            <Skeleton className="h-[300px] w-full rounded-md" />
          ) : methodPieData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
              No payment data available
            </div>
          ) : (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={methodPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) =>
                      percent > 0.05 ? `${name} ${(percent * 100).toFixed(0)}%` : ""
                    }
                    labelLine={{ strokeWidth: 1 }}
                  >
                    {methodPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} strokeWidth={0} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltipContent />} />
                  <Legend
                    wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                    iconType="circle"
                    iconSize={8}
                    formatter={(value: string) => (
                      <span className="text-sm text-foreground capitalize">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Row 4: Failed Payments (left) + Restaurant Settlements (right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Failed Payments */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <CardTitle className="text-base font-semibold">Failed Payments</CardTitle>
              {(failedPayments?.length ?? 0) > 0 && (
                <span className="ml-auto inline-flex items-center rounded-full bg-red-100 text-red-800 px-2 py-0.5 text-[10px] font-medium border border-red-200">
                  {failedPayments?.length}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {failedLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
              </div>
            ) : !failedPayments || failedPayments.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground">No failed payments</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[380px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs font-medium">Payment ID</TableHead>
                      <TableHead className="text-xs font-medium">Order ID</TableHead>
                      <TableHead className="text-xs font-medium">Method</TableHead>
                      <TableHead className="text-xs font-medium text-right">Amount</TableHead>
                      <TableHead className="text-xs font-medium text-right">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failedPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground py-2.5">
                          {payment.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground py-2.5">
                          {payment.order_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell className="text-sm capitalize py-2.5">
                          {payment.method}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-right py-2.5 tabular-nums text-red-600">
                          {formatCurrency(payment.amount)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground text-right py-2.5 whitespace-nowrap">
                          {formatDateTime(payment.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Restaurant Settlements */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Restaurant Settlements</CardTitle>
            <p className="text-xs text-muted-foreground">Payouts owed to restaurants</p>
          </CardHeader>
          <CardContent>
            {settlementsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded" />
                ))}
              </div>
            ) : !settlements || settlements.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-sm text-muted-foreground">No settlements pending</p>
              </div>
            ) : (
              <div className="overflow-auto max-h-[380px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-xs font-medium">Restaurant ID</TableHead>
                      <TableHead className="text-xs font-medium text-right">Orders</TableHead>
                      <TableHead className="text-xs font-medium text-right">Total</TableHead>
                      <TableHead className="text-xs font-medium text-right">Fees</TableHead>
                      <TableHead className="text-xs font-medium text-right">Net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlements.map((s) => {
                      const net = s.total_amount - s.platform_fees;
                      return (
                        <TableRow key={s.restaurant_id}>
                          <TableCell className="font-mono text-xs text-muted-foreground py-2.5">
                            {s.restaurant_id.slice(0, 8)}...
                          </TableCell>
                          <TableCell className="text-sm text-right py-2.5 tabular-nums">
                            {s.total_orders}
                          </TableCell>
                          <TableCell className="text-sm font-medium text-right py-2.5 tabular-nums">
                            {formatCurrency(s.total_amount)}
                          </TableCell>
                          <TableCell className="text-sm text-right py-2.5 tabular-nums text-orange-600">
                            {formatCurrency(s.platform_fees)}
                          </TableCell>
                          <TableCell className="text-sm font-semibold text-right py-2.5 tabular-nums text-emerald-600">
                            {formatCurrency(net)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
