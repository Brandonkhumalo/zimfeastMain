import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest } from "@/lib/apiRequest";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageHeader from "./components/PageHeader";
import StatCard from "./components/StatCard";
import StatusBadge from "./components/StatusBadge";
import DataTable, { type ColumnDef } from "./components/DataTable";
import ExportButton from "./components/ExportButton";
import {
  Users,
  ShoppingBag,
  Store,
  Truck,
  Search,
  Eye,
  Ban,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface UserStats {
  total: number;
  customers: number;
  restaurants: number;
  drivers: number;
  admins: number;
}

interface UserRecord {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  date_joined?: string;
}

interface PaginatedUsers {
  results: UserRecord[];
  total: number;
  page: number;
}

// ── Role badge colors ────────────────────────────────────────────────────────

const roleBadgeColors: Record<string, string> = {
  customer: "bg-blue-100 text-blue-800 border-blue-200",
  restaurant: "bg-purple-100 text-purple-800 border-purple-200",
  driver: "bg-orange-100 text-orange-800 border-orange-200",
  admin: "bg-red-100 text-red-800 border-red-200",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const { toast } = useToast();

  // Filter / search state
  const [activeRole, setActiveRole] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Suspend dialog state
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<UserRecord | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: stats, isLoading: statsLoading } = useQuery<UserStats>({
    queryKey: ["/api/accounts/admin/stats/"],
  });

  const roleParam = activeRole === "all" ? "" : activeRole;
  const usersQueryKey = `/api/accounts/admin/all-users/?role=${roleParam}&q=${encodeURIComponent(debouncedSearch)}&page=${page}&page_size=${pageSize}`;

  const { data: usersData, isLoading: usersLoading } =
    useQuery<PaginatedUsers>({
      queryKey: [usersQueryKey],
    });

  // ── Suspend / Unsuspend mutation ─────────────────────────────────────────

  const suspendMutation = useMutation({
    mutationFn: async ({
      userId,
      suspend,
      reason,
    }: {
      userId: string;
      suspend: boolean;
      reason?: string;
    }) => {
      return apiRequest(
        `/api/accounts/admin/user/${userId}/suspend/`,
        "PATCH",
        { suspend, reason }
      );
    },
    onSuccess: () => {
      toast({
        title: "User updated",
        description: suspendTarget?.is_active
          ? "User has been suspended."
          : "User has been unsuspended.",
      });
      queryClient.invalidateQueries({
        predicate: (q) =>
          (q.queryKey[0] as string).includes("/api/accounts/admin/"),
      });
      closeSuspendDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Action failed",
        description: error.message || "Could not update user status.",
        variant: "destructive",
      });
    },
  });

  const openSuspendDialog = (user: UserRecord) => {
    setSuspendTarget(user);
    setSuspendReason("");
    setSuspendDialogOpen(true);
  };

  const closeSuspendDialog = () => {
    setSuspendDialogOpen(false);
    setSuspendTarget(null);
    setSuspendReason("");
  };

  const confirmSuspend = () => {
    if (!suspendTarget) return;
    suspendMutation.mutate({
      userId: suspendTarget.id,
      suspend: suspendTarget.is_active,
      reason: suspendReason,
    });
  };

  const handleTabChange = (val: string) => {
    setActiveRole(val);
    setPage(1);
  };

  // ── Table columns ──────────────────────────────────────────────────────────

  const columns: ColumnDef<UserRecord>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (user) => (
        <span className="font-medium">
          {user.first_name} {user.last_name}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      cell: (user) => (
        <span className="text-muted-foreground">{user.email}</span>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (user) => (
        <Badge
          variant="outline"
          className={`border font-medium ${
            roleBadgeColors[user.role] ??
            "bg-zinc-100 text-zinc-800 border-zinc-200"
          }`}
        >
          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (user) => (
        <StatusBadge status={user.is_active ? "active" : "suspended"} />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (user) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/admin/users/${user.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className={
              user.is_active
                ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            }
            onClick={(e) => {
              e.stopPropagation();
              openSuspendDialog(user);
            }}
          >
            {user.is_active ? (
              <>
                <Ban className="h-4 w-4 mr-1" />
                Suspend
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-1" />
                Unsuspend
              </>
            )}
          </Button>
        </div>
      ),
    },
  ];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="View and manage all platform users."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statsLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-3" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <StatCard
              title="Total Users"
              value={stats?.total ?? 0}
              icon={Users}
              color="blue"
            />
            <StatCard
              title="Customers"
              value={stats?.customers ?? 0}
              icon={ShoppingBag}
              color="green"
            />
            <StatCard
              title="Restaurants"
              value={stats?.restaurants ?? 0}
              icon={Store}
              color="purple"
            />
            <StatCard
              title="Drivers"
              value={stats?.drivers ?? 0}
              icon={Truck}
              color="orange"
            />
          </>
        )}
      </div>

      {/* Tabs + Search + Table */}
      <Card>
        <CardContent className="p-6">
          <Tabs
            value={activeRole}
            onValueChange={handleTabChange}
            className="space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="customer">Customers</TabsTrigger>
                <TabsTrigger value="restaurant">Restaurants</TabsTrigger>
                <TabsTrigger value="driver">Drivers</TabsTrigger>
                <TabsTrigger value="admin">Admins</TabsTrigger>
              </TabsList>

              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="pl-9"
                />
              </div>
              <ExportButton
                data={usersData?.results ?? []}
                columns={[
                  { key: "id", header: "User ID" },
                  { key: "email", header: "Email" },
                  { key: "first_name", header: "First Name" },
                  { key: "last_name", header: "Last Name" },
                  { key: "role", header: "Role" },
                  { key: "is_active", header: "Active", transform: (v: any) => v ? "Yes" : "No" },
                  { key: "date_joined", header: "Joined", transform: (v: any) => v ? new Date(v).toLocaleDateString() : "" },
                ]}
                filename={`zimfeast-users-${new Date().toISOString().slice(0, 10)}`}
              />
            </div>

            {/* All tab contents share the same DataTable (query is driven by activeRole state) */}
            {["all", "customer", "restaurant", "driver", "admin"].map(
              (tab) => (
                <TabsContent key={tab} value={tab} className="mt-0">
                  <DataTable<UserRecord>
                    columns={columns}
                    data={usersData?.results ?? []}
                    rowKey={(user) => user.id}
                    isLoading={usersLoading}
                    loadingRows={6}
                    totalItems={usersData?.total}
                    page={page}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    emptyMessage="No users found. Try adjusting your search or filters."
                    emptyIcon={<UserX className="h-10 w-10 mb-2 opacity-50" />}
                  />
                </TabsContent>
              )
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Suspend / Unsuspend Dialog ──────────────────────────────────── */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {suspendTarget?.is_active ? "Suspend User" : "Unsuspend User"}
            </DialogTitle>
            <DialogDescription>
              {suspendTarget?.is_active
                ? `Are you sure you want to suspend ${suspendTarget?.first_name} ${suspendTarget?.last_name}? They will lose access to the platform.`
                : `Are you sure you want to unsuspend ${suspendTarget?.first_name} ${suspendTarget?.last_name}? They will regain access to the platform.`}
            </DialogDescription>
          </DialogHeader>

          {suspendTarget?.is_active && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Reason for suspension
              </label>
              <Textarea
                placeholder="Enter the reason for suspending this user..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeSuspendDialog}>
              Cancel
            </Button>
            <Button
              variant={suspendTarget?.is_active ? "destructive" : "default"}
              disabled={
                suspendMutation.isPending ||
                (suspendTarget?.is_active === true && !suspendReason.trim())
              }
              onClick={confirmSuspend}
            >
              {suspendMutation.isPending
                ? "Processing..."
                : suspendTarget?.is_active
                ? "Suspend"
                : "Unsuspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
