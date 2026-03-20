import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import PageHeader from "./components/PageHeader";
import StatusBadge from "./components/StatusBadge";
import {
  ArrowLeft,
  Star,
  Phone,
  Car,
  FileText,
  Ban,
  ShieldCheck,
  Package,
  AlertCircle,
  User,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface DriverDetail {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone: string;
  rating: number;
  total_deliveries: number;
  vehicle_details: string;
  license_number?: string;
  is_active?: boolean;
  is_online?: boolean;
  created_at?: string;
}

// ── Star rating display ──────────────────────────────────────────────────────

function StarRating({
  rating,
  size = "sm",
}: {
  rating: number;
  size?: "sm" | "md";
}) {
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.25 && rating - full < 0.75;
  const empty = 5 - full - (hasHalf ? 1 : 0);
  const starClass = size === "md" ? "h-5 w-5" : "h-3.5 w-3.5";

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: full }).map((_, i) => (
        <Star
          key={`f-${i}`}
          className={`${starClass} fill-amber-400 text-amber-400`}
        />
      ))}
      {hasHalf && (
        <div className="relative">
          <Star className={`${starClass} text-zinc-300`} />
          <div className="absolute inset-0 overflow-hidden w-1/2">
            <Star className={`${starClass} fill-amber-400 text-amber-400`} />
          </div>
        </div>
      )}
      {Array.from({ length: empty }).map((_, i) => (
        <Star key={`e-${i}`} className={`${starClass} text-zinc-300`} />
      ))}
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminDriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  // ── Query ──────────────────────────────────────────────────────────────

  const {
    data: driver,
    isLoading,
    error,
  } = useQuery<DriverDetail>({
    queryKey: [`/api/drivers/admin/driver/${id}/detail/`],
    enabled: !!id,
  });

  // ── Suspend mutation ───────────────────────────────────────────────────

  const suspendMutation = useMutation({
    mutationFn: async ({
      suspend,
      reason,
    }: {
      suspend: boolean;
      reason?: string;
    }) => {
      return apiRequest(
        `/api/drivers/admin/driver/${id}/suspend/`,
        "PATCH",
        { suspend, reason }
      );
    },
    onSuccess: () => {
      toast({
        title: "Driver updated",
        description: driver?.is_active
          ? "Driver has been suspended."
          : "Driver has been unsuspended.",
      });
      queryClient.invalidateQueries({
        predicate: (q) =>
          (q.queryKey[0] as string).includes("/api/drivers/admin/"),
      });
      setSuspendDialogOpen(false);
      setSuspendReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Action failed",
        description: error.message || "Could not update driver status.",
        variant: "destructive",
      });
    },
  });

  const confirmSuspend = () => {
    if (!driver) return;
    suspendMutation.mutate({
      suspend: driver.is_active !== false,
      reason: suspendReason,
    });
  };

  // ── Loading state ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded" />
          <div>
            <Skeleton className="h-7 w-48 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Card>
          <CardContent className="p-6 space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────

  if (error || !driver) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Driver Not Found"
          actions={
            <Link href="/admin/drivers">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Drivers
              </Button>
            </Link>
          }
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">Driver not found</p>
            <p className="text-sm">
              The driver you are looking for does not exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const isActive = driver.is_active !== false;

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <PageHeader
        title={driver.name}
        description={driver.email || `Driver ID: ${driver.id}`}
        actions={
          <Link href="/admin/drivers">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Drivers
            </Button>
          </Link>
        }
      />

      {/* Status badges */}
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge status={isActive ? "active" : "suspended"} />
        {driver.is_online !== undefined && (
          <StatusBadge status={driver.is_online ? "online" : "offline"} />
        )}
        <div className="flex items-center gap-1.5">
          <StarRating rating={driver.rating || 0} size="md" />
          <span className="text-sm font-medium ml-1">
            {(driver.rating || 0).toFixed(1)}
          </span>
        </div>
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Package className="h-3.5 w-3.5" />
          {driver.total_deliveries ?? 0} deliveries
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Driver Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Full Name</p>
                <p className="font-medium">{driver.name || "---"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Phone
                </p>
                <p className="font-medium">{driver.phone || "Not provided"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Car className="h-3.5 w-3.5" /> Vehicle
                </p>
                <p className="font-medium">
                  {driver.vehicle_details || "Not specified"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> License
                </p>
                <p className="font-medium">
                  {driver.license_number || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Star className="h-3.5 w-3.5" /> Rating
                </p>
                <div className="flex items-center gap-2">
                  <StarRating rating={driver.rating || 0} />
                  <span className="font-medium">
                    {(driver.rating || 0).toFixed(1)}
                  </span>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Package className="h-3.5 w-3.5" /> Total Deliveries
                </p>
                <p className="font-medium">{driver.total_deliveries ?? 0}</p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Driver ID</p>
                <p className="font-mono text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  {driver.id}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">User ID</p>
                <p className="font-mono text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                  {driver.user_id}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant={isActive ? "destructive" : "default"}
                className="w-full"
                onClick={() => {
                  setSuspendReason("");
                  setSuspendDialogOpen(true);
                }}
              >
                {isActive ? (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Suspend Driver
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Unsuspend Driver
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Delivery stats card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Delivery Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">
                    Total Deliveries
                  </span>
                  <span className="font-medium">
                    {driver.total_deliveries ?? 0}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Rating</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span className="font-medium">
                      {(driver.rating || 0).toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Suspend / Unsuspend Dialog ──────────────────────────────────── */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {isActive ? "Suspend Driver" : "Unsuspend Driver"}
            </DialogTitle>
            <DialogDescription>
              {isActive
                ? `Are you sure you want to suspend ${driver.name}? They will not be able to accept deliveries.`
                : `Are you sure you want to unsuspend ${driver.name}? They will be able to accept deliveries again.`}
            </DialogDescription>
          </DialogHeader>

          {isActive && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Reason for suspension
              </label>
              <Textarea
                placeholder="Enter the reason for suspending this driver..."
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuspendDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={isActive ? "destructive" : "default"}
              disabled={
                suspendMutation.isPending ||
                (isActive && !suspendReason.trim())
              }
              onClick={confirmSuspend}
            >
              {suspendMutation.isPending
                ? "Processing..."
                : isActive
                ? "Suspend"
                : "Unsuspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
