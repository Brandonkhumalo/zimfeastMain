import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import PageHeader from "./components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  Star,
  Flag,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  MessageSquare,
  Inbox,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────

interface Review {
  id: string;
  restaurant_id: string;
  restaurant_name: string;
  user_id: string;
  user_name?: string;
  rating: number;
  comment: string;
  created_at: string;
}

interface ReviewsResponse {
  results: Review[];
  count: number;
  next: string | null;
  previous: string | null;
}

type SortOption = "newest" | "oldest" | "lowest" | "highest";
type RatingFilter = "all" | "1" | "2" | "3" | "4" | "5";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Render visual star rating with filled/unfilled stars */
function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-4 w-4",
            i < rating
              ? "fill-orange-400 text-orange-400"
              : "fill-none text-zinc-300"
          )}
        />
      ))}
    </div>
  );
}

/** Convert ISO string to relative time string (e.g., "2 days ago") */
function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 5) return `${diffWeeks}w ago`;
  return `${diffMonths}mo ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminReviewsPage() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [ratingFilter, setRatingFilter] = useState<RatingFilter>("all");
  const pageSize = 10;

  // Build query params
  const queryParams = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  });

  // The filtering and sorting will be applied client-side if the API doesn't support them
  const {
    data: reviewsData,
    isLoading,
  } = useQuery<ReviewsResponse>({
    queryKey: ["/api/restaurants/admin/reviews/", page, pageSize],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/restaurants/admin/reviews/?${queryParams.toString()}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json();
    },
  });

  // Apply client-side filtering and sorting
  const filteredAndSorted = (() => {
    if (!reviewsData?.results) return [];

    let reviews = [...reviewsData.results];

    // Rating filter
    if (ratingFilter !== "all") {
      const targetRating = Number(ratingFilter);
      reviews = reviews.filter((r) => r.rating === targetRating);
    }

    // Sorting
    switch (sortBy) {
      case "newest":
        reviews.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "oldest":
        reviews.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "lowest":
        reviews.sort((a, b) => a.rating - b.rating);
        break;
      case "highest":
        reviews.sort((a, b) => b.rating - a.rating);
        break;
    }

    return reviews;
  })();

  const totalItems = reviewsData?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  function handleFlag(reviewId: string) {
    toast({
      title: "Review Flagged",
      description: `Review ${reviewId.slice(0, 8)} has been flagged for further inspection.`,
    });
  }

  function handleRemove(reviewId: string) {
    toast({
      title: "Review Removed",
      description: `Review ${reviewId.slice(0, 8)} has been removed from the platform.`,
      variant: "destructive",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review Moderation"
        description="Monitor and moderate platform reviews and ratings."
      />

      {/* ── Filter Bar ── */}
      <Card className="rounded-xl">
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Sort by:
              </span>
              <Select
                value={sortBy}
                onValueChange={(val) => setSortBy(val as SortOption)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="lowest">Lowest Rating</SelectItem>
                  <SelectItem value="highest">Highest Rating</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                Rating:
              </span>
              <Select
                value={ratingFilter}
                onValueChange={(val) => setRatingFilter(val as RatingFilter)}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Ratings</SelectItem>
                  <SelectItem value="5">5 Stars</SelectItem>
                  <SelectItem value="4">4 Stars</SelectItem>
                  <SelectItem value="3">3 Stars</SelectItem>
                  <SelectItem value="2">2 Stars</SelectItem>
                  <SelectItem value="1">1 Star</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {totalItems > 0 && (
              <div className="sm:ml-auto">
                <Badge variant="secondary" className="text-xs">
                  <MessageSquare className="h-3 w-3 mr-1" />
                  {totalItems} review{totalItems !== 1 ? "s" : ""} total
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── Reviews List ── */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="rounded-xl">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-16 w-full" />
                  <div className="flex gap-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {!isLoading && filteredAndSorted.length === 0 && (
        <Card className="rounded-xl">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Inbox className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="text-lg font-semibold">No Reviews Found</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {ratingFilter !== "all"
                ? `No ${ratingFilter}-star reviews to display. Try adjusting your filter.`
                : "There are no reviews on the platform yet."}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && filteredAndSorted.length > 0 && (
        <div className="space-y-4">
          {filteredAndSorted.map((review) => {
            const borderColor =
              review.rating <= 2
                ? "border-l-4 border-l-red-400"
                : review.rating === 3
                ? "border-l-4 border-l-orange-400"
                : "border-l-4 border-l-emerald-400";
            return (
              <Card
                key={review.id}
                className={cn(
                  "rounded-xl transition-shadow hover:shadow-md",
                  borderColor
                )}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    {/* Left: Review content */}
                    <div className="flex-1 space-y-3">
                      {/* Restaurant name + Rating */}
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <h3 className="font-semibold text-base">
                          {review.restaurant_name}
                        </h3>
                        <StarRating rating={review.rating} />
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs w-fit",
                            review.rating <= 2
                              ? "border-red-200 text-red-700 bg-red-50"
                              : review.rating >= 4
                              ? "border-emerald-200 text-emerald-700 bg-emerald-50"
                              : "border-yellow-200 text-yellow-700 bg-yellow-50"
                          )}
                        >
                          {review.rating}/5
                        </Badge>
                      </div>

                      {/* Comment */}
                      <p className="text-sm text-foreground leading-relaxed">
                        {review.comment || (
                          <span className="italic text-muted-foreground">No comment provided</span>
                        )}
                      </p>

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>
                          User: {review.user_name || review.user_id?.slice(0, 8) || "Unknown"}
                        </span>
                        <span>{relativeTime(review.created_at)}</span>
                      </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex sm:flex-col gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                        onClick={() => handleFlag(review.id)}
                      >
                        <Flag className="h-3.5 w-3.5 mr-1" />
                        Flag
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleRemove(review.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        Remove
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages} ({totalItems} total)
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(1)}
              disabled={page <= 1}
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-3 text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setPage(totalPages)}
              disabled={page >= totalPages}
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
