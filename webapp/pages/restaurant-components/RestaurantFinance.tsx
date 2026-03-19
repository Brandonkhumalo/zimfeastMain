import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface FinanceSummary {
  total_revenue: string;
  total_platform_fees: string;
  total_earnings: string;
  unsettled_platform_fees: string;
  unsettled_delivery_fees: string;
  total_debt: string;
  total_orders: number;
  last_updated: string;
}

interface Earning {
  id: string;
  order_id: string;
  order_total: string;
  delivery_fee: string;
  platform_commission_pct: string;
  platform_fee: string;
  restaurant_earning: string;
  paid_direct: boolean;
  settled: boolean;
  created: string;
}

interface Debt {
  id: string;
  order_id: string;
  platform_fee: string;
  delivery_fee: string;
  total_owed: string;
  settled: boolean;
  created: string;
}

interface FinanceData {
  summary: FinanceSummary;
  recent_earnings: Earning[];
  unsettled_debts: Debt[];
}

const fmt = (val: string | number) => {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return isNaN(n) ? "$0.00" : `$${n.toFixed(2)}`;
};

const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

export default function RestaurantFinance() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"earnings" | "debts">("earnings");

  useEffect(() => {
    const fetchFinance = async () => {
      const token = localStorage.getItem("token");
      try {
        const res = await fetch("/api/restaurants/finance/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to load finance data");
        const json = await res.json();
        setData(json);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchFinance();
  }, []);

  if (loading) return <div className="text-center py-12 text-muted-foreground">Loading finance data...</div>;
  if (error) return <div className="text-center py-12 text-red-500">{error}</div>;
  if (!data) return null;

  const { summary, recent_earnings, unsettled_debts } = data;
  const hasDebt = parseFloat(summary.total_debt) > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Revenue" value={fmt(summary.total_revenue)} sub={`${summary.total_orders} orders`} />
        <SummaryCard label="Your Earnings" value={fmt(summary.total_earnings)} sub="After platform fees" accent="green" />
        <SummaryCard label="Platform Fees" value={fmt(summary.total_platform_fees)} sub="Commission charged" />
        <SummaryCard
          label="Amount You Owe"
          value={fmt(summary.total_debt)}
          sub={hasDebt ? "From direct payment orders" : "No outstanding debt"}
          accent={hasDebt ? "red" : "green"}
        />
      </div>

      {/* Debt breakdown (only if restaurant has debt) */}
      {hasDebt && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-6 text-sm">
              <div>
                <span className="text-muted-foreground">Unsettled Platform Fees: </span>
                <span className="font-semibold">{fmt(summary.unsettled_platform_fees)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Unsettled Delivery Fees: </span>
                <span className="font-semibold">{fmt(summary.unsettled_delivery_fees)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tab switcher */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setTab("earnings")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "earnings"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Recent Earnings ({recent_earnings.length})
        </button>
        <button
          onClick={() => setTab("debts")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "debts"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Unsettled Debts ({unsettled_debts.length})
          {unsettled_debts.length > 0 && (
            <Badge variant="destructive" className="ml-2 text-xs">{unsettled_debts.length}</Badge>
          )}
        </button>
      </div>

      {/* Earnings table */}
      {tab === "earnings" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Recent Earnings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recent_earnings.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No earnings recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="text-right">Order Total</TableHead>
                      <TableHead className="text-right">Delivery Fee</TableHead>
                      <TableHead className="text-right">Commission</TableHead>
                      <TableHead className="text-right">Platform Fee</TableHead>
                      <TableHead className="text-right">Your Earning</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent_earnings.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(e.created)}</TableCell>
                        <TableCell className="font-mono text-xs">#{e.order_id.slice(-8)}</TableCell>
                        <TableCell className="text-right">{fmt(e.order_total)}</TableCell>
                        <TableCell className="text-right">{fmt(e.delivery_fee)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{parseFloat(e.platform_commission_pct).toFixed(1)}%</TableCell>
                        <TableCell className="text-right text-red-500">-{fmt(e.platform_fee)}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">{fmt(e.restaurant_earning)}</TableCell>
                        <TableCell>
                          {e.paid_direct ? (
                            <Badge variant="outline" className="text-xs">Direct</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Platform</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Debts table */}
      {tab === "debts" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Unsettled Debts</CardTitle>
            <p className="text-sm text-muted-foreground">
              When customers pay you directly, you owe the platform commission fees and delivery fees for each order.
            </p>
          </CardHeader>
          <CardContent className="p-0">
            {unsettled_debts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No outstanding debts. You're all clear!</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="text-right">Platform Fee</TableHead>
                      <TableHead className="text-right">Delivery Fee</TableHead>
                      <TableHead className="text-right">Total Owed</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {unsettled_debts.map((d) => (
                      <TableRow key={d.id}>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{fmtDate(d.created)}</TableCell>
                        <TableCell className="font-mono text-xs">#{d.order_id.slice(-8)}</TableCell>
                        <TableCell className="text-right">{fmt(d.platform_fee)}</TableCell>
                        <TableCell className="text-right">{fmt(d.delivery_fee)}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">{fmt(d.total_owed)}</TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">Unsettled</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }: { label: string; value: string; sub: string; accent?: string }) {
  const colorClass =
    accent === "green" ? "text-green-600" :
    accent === "red" ? "text-red-600" :
    "text-foreground";

  return (
    <Card>
      <CardContent className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold mt-1 ${colorClass}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </CardContent>
    </Card>
  );
}
