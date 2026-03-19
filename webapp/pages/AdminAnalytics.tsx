import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";

interface PeriodStats {
  orders: number;
  revenue: number;
  avg_order_value: number;
}

interface Analytics {
  today: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
  all_time: { orders: number; revenue: number };
  status_breakdown: Record<string, number>;
  method_breakdown: Record<string, number>;
  top_restaurants: Array<{
    restaurant_id: string;
    restaurant_name: string;
    order_count: number;
    total_revenue: number;
  }>;
  recent_orders: Array<{
    id: string;
    restaurant_names: string;
    total_fee: number;
    status: string;
    method: string;
    created: string;
  }>;
  daily_revenue: Array<{ date: string; revenue: number; orders: number }>;
}

interface UserStats {
  customers: number;
  restaurants: number;
  drivers: number;
  admins: number;
  total: number;
}

interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-yellow-500/20 text-yellow-400",
  paid: "bg-blue-500/20 text-blue-400",
  preparing: "bg-purple-500/20 text-purple-400",
  ready: "bg-cyan-500/20 text-cyan-400",
  collected: "bg-teal-500/20 text-teal-400",
  assigned: "bg-indigo-500/20 text-indigo-400",
  out_for_delivery: "bg-orange-500/20 text-orange-400",
  delivered: "bg-green-500/20 text-green-400",
  cancelled: "bg-red-500/20 text-red-400",
};

const PIE_COLORS = ["#f97316", "#3b82f6", "#8b5cf6", "#06b6d4", "#10b981", "#ef4444", "#eab308", "#ec4899", "#6366f1"];

function adminFetch(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("admin_token");
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    },
  });
}

export default function AdminAnalytics() {
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"overview" | "orders" | "restaurants" | "users">("overview");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setLocation("/zimfeast/admin/login");
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [analyticsRes, statsRes, usersRes] = await Promise.all([
        adminFetch("/api/orders/admin/analytics/"),
        adminFetch("/api/accounts/admin/stats/"),
        adminFetch("/api/accounts/admin/users/"),
      ]);

      if (analyticsRes.ok) setAnalytics(await analyticsRes.json());
      if (statsRes.ok) setUserStats(await statsRes.json());
      if (usersRes.ok) setAdminUsers(await usersRes.json());
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    setLocation("/zimfeast/admin/login");
  };

  const handleDeleteAdmin = async (userId: string) => {
    if (!confirm("Are you sure you want to remove this admin?")) return;
    try {
      const res = await adminFetch(`/api/accounts/admin/users/${userId}/`, { method: "DELETE" });
      if (res.ok) {
        setAdminUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete admin");
      }
    } catch {
      alert("Network error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400 text-lg">Loading analytics...</div>
      </div>
    );
  }

  const statusData = analytics
    ? Object.entries(analytics.status_breakdown).map(([name, value]) => ({ name: name.replace(/_/g, " "), value }))
    : [];

  const methodData = analytics
    ? Object.entries(analytics.method_breakdown).map(([name, value]) => ({ name: name || "unknown", value }))
    : [];

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "orders" as const, label: "Orders" },
    { key: "restaurants" as const, label: "Restaurants" },
    { key: "users" as const, label: "User Management" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">ZimFeast Analytics</h1>
          <p className="text-xs text-zinc-500">Admin Dashboard</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLocation("/zimfeast/admin/register_user")}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Add Admin
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-zinc-400 hover:text-white">
            Logout
          </Button>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-6">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
                activeTab === tab.key
                  ? "border-orange-500 text-orange-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {activeTab === "overview" && analytics && <OverviewTab analytics={analytics} userStats={userStats} />}
        {activeTab === "orders" && analytics && <OrdersTab analytics={analytics} />}
        {activeTab === "restaurants" && analytics && <RestaurantsTab analytics={analytics} />}
        {activeTab === "users" && (
          <UsersTab
            adminUsers={adminUsers}
            userStats={userStats}
            onDelete={handleDeleteAdmin}
            onNavigateRegister={() => setLocation("/zimfeast/admin/register_user")}
          />
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <Card className="bg-zinc-900 border-zinc-800">
      <CardContent className="pt-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-white mt-1">{value}</p>
        {sub && <p className="text-xs text-zinc-500 mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function OverviewTab({ analytics, userStats }: { analytics: Analytics; userStats: UserStats | null }) {
  const statusData = Object.entries(analytics.status_breakdown).map(([name, value]) => ({
    name: name.replace(/_/g, " "),
    value,
  }));

  return (
    <div className="space-y-6">
      {/* Period Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Today's Revenue" value={`$${analytics.today.revenue.toFixed(2)}`} sub={`${analytics.today.orders} orders`} />
        <StatCard label="This Week" value={`$${analytics.week.revenue.toFixed(2)}`} sub={`${analytics.week.orders} orders`} />
        <StatCard label="This Month" value={`$${analytics.month.revenue.toFixed(2)}`} sub={`${analytics.month.orders} orders`} />
        <StatCard label="All Time" value={`$${analytics.all_time.revenue.toFixed(2)}`} sub={`${analytics.all_time.orders} orders`} />
      </div>

      {/* Avg Order Value */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Avg Order (Today)" value={`$${analytics.today.avg_order_value.toFixed(2)}`} />
        <StatCard label="Avg Order (Week)" value={`$${analytics.week.avg_order_value.toFixed(2)}`} />
        <StatCard label="Avg Order (Month)" value={`$${analytics.month.avg_order_value.toFixed(2)}`} />
      </div>

      {/* User Stats */}
      {userStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Users" value={userStats.total} />
          <StatCard label="Customers" value={userStats.customers} />
          <StatCard label="Restaurants" value={userStats.restaurants} />
          <StatCard label="Drivers" value={userStats.drivers} />
          <StatCard label="Admins" value={userStats.admins} />
        </div>
      )}

      {/* Revenue Chart */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Revenue (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics.daily_revenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                <YAxis stroke="#71717a" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }}
                  labelFormatter={(d) => `Date: ${d}`}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, "Revenue"]}
                />
                <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Orders Chart + Status Pie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Daily Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.daily_revenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="date" stroke="#71717a" tick={{ fontSize: 11 }} tickFormatter={(d) => d.slice(5)} />
                  <YAxis stroke="#71717a" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
                  <Bar dataKey="orders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Order Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function OrdersTab({ analytics }: { analytics: Analytics }) {
  const methodData = Object.entries(analytics.method_breakdown).map(([name, value]) => ({
    name: name || "unknown",
    value,
  }));

  return (
    <div className="space-y-6">
      {/* Method Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {methodData.map((m) => (
          <StatCard key={m.name} label={m.name.charAt(0).toUpperCase() + m.name.slice(1)} value={m.value} sub="orders" />
        ))}
        <StatCard label="Total Orders" value={analytics.all_time.orders} />
      </div>

      {/* Recent Orders Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-400">Order ID</TableHead>
                <TableHead className="text-zinc-400">Restaurant</TableHead>
                <TableHead className="text-zinc-400">Amount</TableHead>
                <TableHead className="text-zinc-400">Status</TableHead>
                <TableHead className="text-zinc-400">Method</TableHead>
                <TableHead className="text-zinc-400">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.recent_orders.map((order) => (
                <TableRow key={order.id} className="border-zinc-800">
                  <TableCell className="text-zinc-300 font-mono text-xs">{order.id.slice(0, 8)}...</TableCell>
                  <TableCell className="text-white">{order.restaurant_names || "N/A"}</TableCell>
                  <TableCell className="text-white font-semibold">${order.total_fee.toFixed(2)}</TableCell>
                  <TableCell>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${STATUS_COLORS[order.status] || "bg-zinc-700 text-zinc-300"}`}>
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-zinc-400 capitalize">{order.method || "N/A"}</TableCell>
                  <TableCell className="text-zinc-500 text-xs">{new Date(order.created).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function RestaurantsTab({ analytics }: { analytics: Analytics }) {
  return (
    <div className="space-y-6">
      {/* Top Restaurant Bar Chart */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Top Restaurants by Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.top_restaurants} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis type="number" stroke="#71717a" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="restaurant_name"
                  stroke="#71717a"
                  tick={{ fontSize: 11 }}
                  width={140}
                  tickFormatter={(v) => (v && v.length > 18 ? v.slice(0, 18) + "..." : v || "Unknown")}
                />
                <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, color: "#fff" }} />
                <Legend />
                <Bar dataKey="order_count" name="Orders" fill="#f97316" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Restaurant Revenue Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Restaurant Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-400">#</TableHead>
                <TableHead className="text-zinc-400">Restaurant</TableHead>
                <TableHead className="text-zinc-400">Orders</TableHead>
                <TableHead className="text-zinc-400">Revenue</TableHead>
                <TableHead className="text-zinc-400">Avg/Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analytics.top_restaurants.map((r, i) => (
                <TableRow key={r.restaurant_id} className="border-zinc-800">
                  <TableCell className="text-zinc-500 font-bold">{i + 1}</TableCell>
                  <TableCell className="text-white font-medium">{r.restaurant_name || "Unknown"}</TableCell>
                  <TableCell className="text-zinc-300">{r.order_count}</TableCell>
                  <TableCell className="text-green-400 font-semibold">${r.total_revenue.toFixed(2)}</TableCell>
                  <TableCell className="text-zinc-400">${r.order_count > 0 ? (r.total_revenue / r.order_count).toFixed(2) : "0.00"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function UsersTab({
  adminUsers,
  userStats,
  onDelete,
  onNavigateRegister,
}: {
  adminUsers: AdminUser[];
  userStats: UserStats | null;
  onDelete: (id: string) => void;
  onNavigateRegister: () => void;
}) {
  return (
    <div className="space-y-6">
      {userStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <StatCard label="Total Users" value={userStats.total} />
          <StatCard label="Customers" value={userStats.customers} />
          <StatCard label="Restaurants" value={userStats.restaurants} />
          <StatCard label="Drivers" value={userStats.drivers} />
          <StatCard label="Admins" value={userStats.admins} />
        </div>
      )}

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white text-base">Admin Users</CardTitle>
          <Button onClick={onNavigateRegister} size="sm" className="bg-orange-600 hover:bg-orange-500">
            Add Admin
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead className="text-zinc-400">Email</TableHead>
                <TableHead className="text-zinc-400">Name</TableHead>
                <TableHead className="text-zinc-400">ID</TableHead>
                <TableHead className="text-zinc-400">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {adminUsers.map((user) => (
                <TableRow key={user.id} className="border-zinc-800">
                  <TableCell className="text-white">{user.email}</TableCell>
                  <TableCell className="text-zinc-300">{user.first_name} {user.last_name}</TableCell>
                  <TableCell className="text-zinc-500 font-mono text-xs">{user.id.slice(0, 8)}...</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(user.id)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    >
                      Remove
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {adminUsers.length === 0 && (
                <TableRow className="border-zinc-800">
                  <TableCell colSpan={4} className="text-center text-zinc-500 py-8">
                    No admin users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
