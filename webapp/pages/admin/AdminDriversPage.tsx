import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./components/PageHeader";
import StatCard from "./components/StatCard";
import DataTable, { type ColumnDef } from "./components/DataTable";
import {
  Truck,
  Wifi,
  Star,
  Search,
  Eye,
  UserX,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Driver {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  rating: number;
  total_deliveries: number;
  vehicle_details: string;
}

interface PaginatedDrivers {
  results: Driver[];
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

export default function AdminDriversPage() {
  // Filter state
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 15;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ── Query ──────────────────────────────────────────────────────────────

  const queryKey = `/api/drivers/admin/list/?q=${encodeURIComponent(debouncedSearch)}&page=${page}&page_size=${pageSize}`;

  const { data, isLoading } = useQuery<PaginatedDrivers>({
    queryKey: [queryKey],
  });

  // ── Computed stats ─────────────────────────────────────────────────────

  const computedStats = useMemo(() => {
    if (!data) return { total: 0, onlineNow: 0, avgRating: 0 };
    const total = data.total;
    // Online count is a placeholder since we don't have real-time status in this endpoint
    const onlineNow = 0;
    const ratings = data.results.filter((d) => d.rating > 0);
    const avgRating =
      ratings.length > 0
        ? ratings.reduce((sum, d) => sum + d.rating, 0) / ratings.length
        : 0;
    return { total, onlineNow, avgRating };
  }, [data]);

  // ── Table columns ──────────────────────────────────────────────────────

  const columns: ColumnDef<Driver>[] = [
    {
      key: "name",
      header: "Name",
      sortable: true,
      cell: (driver) => (
        <Link href={`/admin/drivers/${driver.id}`}>
          <span className="font-medium hover:text-orange-600 transition-colors">
            {driver.name}
          </span>
        </Link>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      cell: (driver) => (
        <span className="text-muted-foreground">{driver.phone || "---"}</span>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      sortable: true,
      cell: (driver) => <StarRating rating={driver.rating || 0} />,
    },
    {
      key: "total_deliveries",
      header: "Deliveries",
      sortable: true,
      cell: (driver) => (
        <span className="text-muted-foreground font-medium">
          {driver.total_deliveries ?? 0}
        </span>
      ),
    },
    {
      key: "vehicle_details",
      header: "Vehicle",
      cell: (driver) => (
        <span className="text-muted-foreground text-sm">
          {driver.vehicle_details || "---"}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      cell: (driver) => (
        <div className="flex items-center justify-end">
          <Link href={`/admin/drivers/${driver.id}`}>
            <Button variant="ghost" size="sm">
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Drivers"
        description="Manage delivery drivers and their profiles."
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
              title="Total Drivers"
              value={computedStats.total}
              icon={Truck}
              color="orange"
            />
            <StatCard
              title="Online Now"
              value={computedStats.onlineNow}
              subtitle="Real-time data coming soon"
              icon={Wifi}
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
                placeholder="Search drivers..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <DataTable<Driver>
            columns={columns}
            data={data?.results ?? []}
            rowKey={(d) => d.id}
            isLoading={isLoading}
            loadingRows={6}
            totalItems={data?.total}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            emptyMessage="No drivers found. Try adjusting your search."
            emptyIcon={<UserX className="h-10 w-10 mb-2 opacity-50" />}
          />
        </CardContent>
      </Card>
    </div>
  );
}
