import { useState, useEffect, useMemo } from "react";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import PageHeader from "./components/PageHeader";
import StatCard from "./components/StatCard";
import DataTable, { type ColumnDef } from "./components/DataTable";
import {
  Store,
  DoorOpen,
  Star,
  Search,
  Ban,
  ShieldCheck,
  Eye,
  StoreIcon,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface Restaurant {
  id: string;
  name: string;
  owner_id: string;
  is_open: boolean;
  is_suspended?: boolean;
  average_rating: number;
  total_reviews: number;
  created: string;
}

interface PaginatedRestaurants {
  results: Restaurant[];
  total: number;
  page: number;
}

// ── Star rating display ──────────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const empty = 5 - full - (hasHalf ? 1 : 0);

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star
          key={`f-${i}`}
          className="h-3.5 w-3.5 fill-amber-400 text-amber-400"
        />
      ))}
      {hasHalf && (
        <div className="relative">
          <Star className="h-3.5 w-3.5 text-zinc-300" />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          </div>
        </div>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e-${i}`} className="h-3.5 w-3.5 text-zinc-300" />
      ))}
      <span className="text-sm text-muted-foreground ml-1">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminRestaurantsPage() {
  const { toast } = useToast();

  // Filter state
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Suspend dialog
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendTarget, setSuspendTarget] = useState<Restaurant | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Query ──────────────────────────────────────────────────────────────

  const isOpenParam =
    statusFilter === "open"
      ? "true"
      : statusFilter === "closed"
      ? "false"
      : "";

  const queryKey = `/api/restaurants/admin/list/?q=${encodeURIComponent(debouncedSearch)}&is_open=${isOpenParam}&page=${page}&page_size=${pageSize}`;

  const { data, isLoading } = useQuery<PaginatedRestaurants>({
    queryKey: [queryKey],
  });

  // ── Computed stats ─────────────────────────────────────────────────────

  const computedStats = useMemo(() => {
    if (!data) return { total: 0, open: 0, avgRating: 0 };
    const total = data.total;
    const openCount = data.results.filter((r) => r.is_open).length;
    const ratings = data.results.filter((r) => r.average_rating > 0);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.average_rating, 0) / ratings.length
        : 0;
    return { total, open: openCount, avgRating };
  }, [data]);

  // ── Suspend mutation ───────────────────────────────────────────────────

  const suspendMutation = useMutation({
    mutationFn: async ({
      restaurantId,
      suspend,
      reason,
    }: {
      restaurantId: string;
      suspend: boolean;
      reason?: string;
    }) => {
      return apiRequest(
        `/api/restaurants/admin/${restaurantId}/suspend/`,
        "PATCH",
        { suspend, reason }
      );
    },
    onSuccess: () => {
      toast({
        title: "Restaurant updated",
        description: suspendTarget?.is_suspended
          ? "Restaurant has been unsuspended."
          : "Restaurant has been suspended.",
      });
      queryClient.invalidateQueries({
        predicate: (q) =>
          (q.queryKey[0] as string).includes("/api/restaurants/admin/"),
      });
      closeSuspendDialog();
    },
    onError: (error: Error) => {
      toast({
        title: "Action failed",
        description: error.message || "Could not update restaurant.",
        variant: "destructive",
      });
    },
  });

  const openSuspendDialog = (restaurant: Restaurant) => {
    setSuspendTarget(restaurant);
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
      restaurantId: suspendTarget.id,
      suspend: !suspendTarget.is_suspended,
      reason: suspendReason,
    });
  };

  // ── Table columns ──────────────────────────────────────────────────────

  const columns: ColumnDef<Restaurant>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (r) => (
        <Link href={`/admin/restaurants/${r.id}`}>
          <span className="font-medium hover:text-orange-600 transition-colors">
            {r.name}
          </span>
        </Link>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (r) => (
        <Badge
          variant="outline"
          className={`border font-medium ${
            r.is_suspended
              ? "bg-red-100 text-red-800 border-red-200"
              : r.is_open
              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
              : "bg-zinc-100 text-zinc-800 border-zinc-200"
          }`}
        >
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${
              r.is_suspended
                ? "bg-red-500"
                : r.is_open
                ? "bg-emerald-500"
                : "bg-zinc-400"
            }`}
          />
          {r.is_suspended ? "Suspended" : r.is_open ? "Open" : "Closed"}
        </Badge>
      ),
    },
    {
      key: "average_rating",
      header: "Rating",
      sortable: true,
      cell: (r) => <StarRating rating={r.average_rating || 0} />,
    },
    {
      key: "total_reviews",
      header: "Reviews",
      sortable: true,
      cell: (r) => (
        <span className="text-muted-foreground">{r.total_reviews ?? 0}</span>
      ),
    },
    {
      key: "created",
      header: "Created",
      sortable: true,
      cell: (r) => (
        <span className="text-muted-foreground text-sm">
          {r.created
            ? formatDistanceToNow(new Date(r.created), { addSuffix: true })
            : "---"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (r) => (
        <div className="flex items-center justify-end gap-1">
          <Link href={`/admin/restaurants/${r.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className={
              r.is_suspended
                ? "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                : "text-red-600 hover:text-red-700 hover:bg-red-50"
            }
            onClick={(e) => {
              e.stopPropagation();
              openSuspendDialog(r);
            }}
          >
            {r.is_suspended ? (
              <>
                <ShieldCheck className="h-4 w-4 mr-1" />
                Unsuspend
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-1" />
                Suspend
              </>
            )}
          </Button>
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Restaurants"
        description="Manage restaurant partners and their profiles."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
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
              title="Total Restaurants"
              value={computedStats.total}
              icon={Store}
              color="purple"
            />
            <StatCard
              title="Currently Open"
              value={computedStats.open}
              icon={DoorOpen}
              color="green"
            />
            <StatCard
              title="Average Rating"
              value={computedStats.avgRating.toFixed(1)}
              icon={Star}
              color="yellow"
            />
          </>
        )}
      </div>

      {/* Filter bar + Table */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search restaurants..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable<Restaurant>
            columns={columns}
            data={data?.results ?? []}
            rowKey={(r) => r.id}
            isLoading={isLoading}
            loadingRows={6}
            totalItems={data?.total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            emptyMessage="No restaurants found. Try adjusting your search or filters."
            emptyIcon={<StoreIcon className="h-10 w-10 mb-2 opacity-50" />}
          />
        </CardContent>
      </Card>

      {/* ── Suspend Dialog ──────────────────────────────────────────────── */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {suspendTarget?.is_suspended
                ? "Unsuspend Restaurant"
                : "Suspend Restaurant"}
            </DialogTitle>
            <DialogDescription>
              {suspendTarget?.is_suspended
                ? `Are you sure you want to unsuspend "${suspendTarget?.name}"? It will become visible to customers again.`
                : `Are you sure you want to suspend "${suspendTarget?.name}"? It will be hidden from customers.`}
            </DialogDescription>
          </DialogHeader>

          {!suspendTarget?.is_suspended && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Reason for suspension
              </label>
              <Textarea
                placeholder="Enter the reason for suspending this restaurant..."
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
              variant={suspendTarget?.is_suspended ? "default" : "destructive"}
              disabled={
                suspendMutation.isPending ||
                (!suspendTarget?.is_suspended && !suspendReason.trim())
              }
              onClick={confirmSuspend}
            >
              {suspendMutation.isPending
                ? "Processing..."
                : suspendTarget?.is_suspended
                ? "Unsuspend"
                : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
