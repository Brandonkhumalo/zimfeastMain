import { useParams, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
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
  Mail,
  Phone,
  Calendar,
  Shield,
  Ban,
  ShieldCheck,
  User,
  ClipboardList,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface UserDetail {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role: string;
  is_active: boolean;
  date_joined: string;
  last_login?: string;
  addresses?: Array<{
    id: string;
    label: string;
    address_line: string;
    city: string;
  }>;
}

// ── Role badge colors ────────────────────────────────────────────────────────

const roleBadgeColors: Record<string, string> = {
  customer: "bg-blue-100 text-blue-800 border-blue-200",
  restaurant: "bg-purple-100 text-purple-800 border-purple-200",
  driver: "bg-orange-100 text-orange-800 border-orange-200",
  admin: "bg-red-100 text-red-800 border-red-200",
};

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  // Suspend dialog
  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  // ── Query ──────────────────────────────────────────────────────────────

  const {
    data: user,
    isLoading,
    error,
  } = useQuery<UserDetail>({
    queryKey: [`/api/accounts/admin/user/${id}/detail/`],
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
        `/api/accounts/admin/user/${id}/suspend/`,
        "PATCH",
        { suspend, reason }
      );
    },
    onSuccess: () => {
      toast({
        title: "User updated",
        description: user?.is_active
          ? "User has been suspended."
          : "User has been unsuspended.",
      });
      queryClient.invalidateQueries({
        predicate: (q) =>
          (q.queryKey[0] as string).includes("/api/accounts/admin/"),
      });
      setSuspendDialogOpen(false);
      setSuspendReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Action failed",
        description: error.message || "Could not update user status.",
        variant: "destructive",
      });
    },
  });

  const confirmSuspend = () => {
    if (!user) return;
    suspendMutation.mutate({
      suspend: user.is_active,
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

  if (error || !user) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="User Not Found"
          actions={
            <Link href="/admin/users">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Users
              </Button>
            </Link>
          }
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">User not found</p>
            <p className="text-sm">
              The user you are looking for does not exist or has been removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const joinedDate = new Date(user.date_joined).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const joinedAgo = formatDistanceToNow(new Date(user.date_joined), {
    addSuffix: true,
  });

  const lastLoginDate = user.last_login
    ? new Date(user.last_login).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "Never";

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <PageHeader
        title={`${user.first_name} ${user.last_name}`}
        description={user.email}
        actions={
          <Link href="/admin/users">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Users
            </Button>
          </Link>
        }
      />

      {/* Status & role banner */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant="outline"
          className={`border font-medium text-sm px-3 py-1 ${
            roleBadgeColors[user.role] ??
            "bg-zinc-100 text-zinc-800 border-zinc-200"
          }`}
        >
          <Shield className="h-3.5 w-3.5 mr-1.5" />
          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
        </Badge>
        <StatusBadge status={user.is_active ? "active" : "suspended"} />
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          Joined {joinedDate} ({joinedAgo})
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">First Name</p>
                <p className="font-medium">{user.first_name || "---"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Name</p>
                <p className="font-medium">{user.last_name || "---"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> Email
                </p>
                <p className="font-medium">{user.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Phone
                </p>
                <p className="font-medium">
                  {user.phone_number || "Not provided"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Role</p>
                <p className="font-medium capitalize">{user.role}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Login</p>
                <p className="font-medium">{lastLoginDate}</p>
              </div>
            </div>

            {/* Addresses if available */}
            {user.addresses && user.addresses.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm font-medium mb-2">Saved Addresses</p>
                  <div className="space-y-2">
                    {user.addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className="text-sm p-3 bg-muted/50 rounded-lg"
                      >
                        <span className="font-medium">{addr.label}:</span>{" "}
                        {addr.address_line}
                        {addr.city && `, ${addr.city}`}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div>
              <p className="text-sm text-muted-foreground mb-1">User ID</p>
              <p className="font-mono text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                {user.id}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Actions sidebar */}
        <div className="space-y-6">
          {/* Actions card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant={user.is_active ? "destructive" : "default"}
                className="w-full"
                onClick={() => {
                  setSuspendReason("");
                  setSuspendDialogOpen(true);
                }}
              >
                {user.is_active ? (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Suspend User
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Unsuspend User
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Activity placeholder */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardList className="h-4 w-4" />
                Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <ClipboardList className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm text-center">
                  Order history and activity will appear here.
                </p>
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
              {user.is_active ? "Suspend User" : "Unsuspend User"}
            </DialogTitle>
            <DialogDescription>
              {user.is_active
                ? `Are you sure you want to suspend ${user.first_name} ${user.last_name}? They will lose access to the platform.`
                : `Are you sure you want to unsuspend ${user.first_name} ${user.last_name}? They will regain access to the platform.`}
            </DialogDescription>
          </DialogHeader>

          {user.is_active && (
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
            <Button
              variant="outline"
              onClick={() => setSuspendDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant={user.is_active ? "destructive" : "default"}
              disabled={
                suspendMutation.isPending ||
                (user.is_active && !suspendReason.trim())
              }
              onClick={confirmSuspend}
            >
              {suspendMutation.isPending
                ? "Processing..."
                : user.is_active
                ? "Suspend"
                : "Unsuspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
