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
  MapPin,
  Phone,
  Calendar,
  UtensilsCrossed,
  Ban,
  ShieldCheck,
  MessageSquare,
  AlertCircle,
  User,
  DoorClosed,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// ── Types ────────────────────────────────────────────────────────────────────

interface RestaurantDetail {
  id: string;
  name: string;
  owner_id: string;
  owner_name?: string;
  is_open: boolean;
  is_suspended?: boolean;
  rating: number;
  review_count: number;
  cuisine_types?: string[];
  phone?: string;
  address?: string;
  city?: string;
  description?: string;
  delivery_fee?: number;
  min_order?: number;
  created_at: string;
}

interface Review {
  id: string;
  user_name?: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface PaginatedReviews {
  count: number;
  results: Review[];
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

export default function AdminRestaurantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [suspendDialogOpen, setSuspendDialogOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  // ── Queries ────────────────────────────────────────────────────────────

  const {
    data: restaurant,
    isLoading,
    error,
  } = useQuery<RestaurantDetail>({
    queryKey: [`/api/restaurants/${id}/detail/`],
    enabled: !!id,
  });

  const { data: reviewsData, isLoading: reviewsLoading } =
    useQuery<PaginatedReviews | Review[]>({
      queryKey: [`/api/restaurants/${id}/reviews/`],
      enabled: !!id,
    });

  // Normalize reviews (API might return array or paginated object)
  const reviews: Review[] = Array.isArray(reviewsData)
    ? reviewsData.slice(0, 10)
    : (reviewsData as PaginatedReviews)?.results?.slice(0, 10) ?? [];

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
        `/api/restaurants/admin/${id}/suspend/`,
        "PATCH",
        { suspend, reason }
      );
    },
    onSuccess: () => {
      toast({
        title: "Restaurant updated",
        description: restaurant?.is_suspended
          ? "Restaurant has been unsuspended."
          : "Restaurant has been suspended.",
      });
      queryClient.invalidateQueries({
        predicate: (q) =>
          (q.queryKey[0] as string).includes("/api/restaurants/"),
      });
      setSuspendDialogOpen(false);
      setSuspendReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Action failed",
        description: error.message || "Could not update restaurant.",
        variant: "destructive",
      });
    },
  });

  const confirmSuspend = () => {
    if (!restaurant) return;
    suspendMutation.mutate({
      suspend: !restaurant.is_suspended,
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

  if (error || !restaurant) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Restaurant Not Found"
          actions={
            <Link href="/admin/restaurants">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Restaurants
              </Button>
            </Link>
          }
        />
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <AlertCircle className="h-12 w-12 mb-3 opacity-40" />
            <p className="text-lg font-medium">Restaurant not found</p>
            <p className="text-sm">
              The restaurant you are looking for does not exist or has been
              removed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const createdDate = new Date(restaurant.created_at).toLocaleDateString(
    "en-US",
    { month: "long", day: "numeric", year: "numeric" }
  );

  const createdAgo = formatDistanceToNow(new Date(restaurant.created_at), {
    addSuffix: true,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title={restaurant.name}
        description={`Created ${createdDate} (${createdAgo})`}
        actions={
          <Link href="/admin/restaurants">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Restaurants
            </Button>
          </Link>
        }
      />

      {/* Status badges + rating */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant="outline"
          className={`border font-medium text-sm px-3 py-1 ${
            restaurant.is_suspended
              ? "bg-red-100 text-red-800 border-red-200"
              : restaurant.is_open
              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
              : "bg-zinc-100 text-zinc-800 border-zinc-200"
          }`}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
              restaurant.is_suspended
                ? "bg-red-500"
                : restaurant.is_open
                ? "bg-emerald-500"
                : "bg-zinc-400"
            }`}
          />
          {restaurant.is_suspended
            ? "Suspended"
            : restaurant.is_open
            ? "Open"
            : "Closed"}
        </Badge>
        <div className="flex items-center gap-1.5">
          <StarRating rating={restaurant.rating || 0} size="md" />
          <span className="text-sm font-medium ml-1">
            {(restaurant.rating || 0).toFixed(1)}
          </span>
          <span className="text-sm text-muted-foreground">
            ({restaurant.review_count ?? 0} reviews)
          </span>
        </div>
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          <Calendar className="h-3.5 w-3.5" />
          {createdDate}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UtensilsCrossed className="h-4 w-4" />
              Restaurant Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {restaurant.address && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> Address
                  </p>
                  <p className="font-medium">
                    {restaurant.address}
                    {restaurant.city && `, ${restaurant.city}`}
                  </p>
                </div>
              )}
              {restaurant.phone && (
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> Phone
                  </p>
                  <p className="font-medium">{restaurant.phone}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" /> Created
                </p>
                <p className="font-medium">{createdDate}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <User className="h-3.5 w-3.5" /> Owner
                </p>
                <p className="font-medium">
                  {restaurant.owner_name || restaurant.owner_id || "---"}
                </p>
              </div>
            </div>

            {/* Cuisine types */}
            {restaurant.cuisine_types &&
              restaurant.cuisine_types.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Cuisine Types
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {restaurant.cuisine_types.map((ct) => (
                        <Badge key={ct} variant="secondary">
                          {ct}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}

            {/* Delivery info */}
            {(restaurant.delivery_fee !== undefined ||
              restaurant.min_order !== undefined) && (
              <>
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  {restaurant.delivery_fee !== undefined && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Delivery Fee
                      </p>
                      <p className="font-medium">
                        ${restaurant.delivery_fee.toFixed(2)}
                      </p>
                    </div>
                  )}
                  {restaurant.min_order !== undefined && (
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Minimum Order
                      </p>
                      <p className="font-medium">
                        ${restaurant.min_order.toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}

            {restaurant.description && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-1">
                    Description
                  </p>
                  <p className="text-sm">{restaurant.description}</p>
                </div>
              </>
            )}

            <Separator />
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Restaurant ID
              </p>
              <p className="font-mono text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                {restaurant.id}
              </p>
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
                variant={restaurant.is_suspended ? "default" : "destructive"}
                className="w-full"
                onClick={() => {
                  setSuspendReason("");
                  setSuspendDialogOpen(true);
                }}
              >
                {restaurant.is_suspended ? (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Unsuspend Restaurant
                  </>
                ) : (
                  <>
                    <Ban className="h-4 w-4 mr-2" />
                    Suspend Restaurant
                  </>
                )}
              </Button>
              {restaurant.is_open && !restaurant.is_suspended && (
                <Button variant="outline" className="w-full">
                  <DoorClosed className="h-4 w-4 mr-2" />
                  Force Close
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Reviews section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-4 w-4" />
            Latest Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reviewsLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ))}
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No reviews yet for this restaurant.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div
                  key={review.id}
                  className="p-4 bg-muted/30 rounded-lg border"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} />
                      <span className="text-sm font-medium ml-1">
                        {review.user_name || "Anonymous"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground">
                      {review.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Suspend Dialog ──────────────────────────────────────────────── */}
      <Dialog open={suspendDialogOpen} onOpenChange={setSuspendDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>
              {restaurant.is_suspended
                ? "Unsuspend Restaurant"
                : "Suspend Restaurant"}
            </DialogTitle>
            <DialogDescription>
              {restaurant.is_suspended
                ? `Are you sure you want to unsuspend "${restaurant.name}"?`
                : `Are you sure you want to suspend "${restaurant.name}"? It will be hidden from customers.`}
            </DialogDescription>
          </DialogHeader>

          {!restaurant.is_suspended && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Reason for suspension
              </label>
              <Textarea
                placeholder="Enter the reason..."
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
              variant={restaurant.is_suspended ? "default" : "destructive"}
              disabled={
                suspendMutation.isPending ||
                (!restaurant.is_suspended && !suspendReason.trim())
              }
              onClick={confirmSuspend}
            >
              {suspendMutation.isPending
                ? "Processing..."
                : restaurant.is_suspended
                ? "Unsuspend"
                : "Suspend"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
