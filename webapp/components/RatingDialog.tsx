import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/apiRequest";

interface RatingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  driverName: string;
  driverId?: string;
}

/**
 * StarSelector renders 5 clickable stars. The user clicks to select a 1-5 rating.
 * Filled stars use orange, unfilled stars use gray.
 */
function StarSelector({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="mb-4">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= (hovered || value);
          return (
            <button
              key={star}
              type="button"
              className="focus:outline-none transition-transform hover:scale-110"
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => onChange(star)}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={filled ? "#F97316" : "none"}
                stroke={filled ? "#F97316" : "#9CA3AF"}
                strokeWidth={1.5}
                className="w-8 h-8"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
                />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function RatingDialog({
  isOpen,
  onClose,
  orderId,
  restaurantId,
  restaurantName,
  driverName,
  driverId,
}: RatingDialogProps) {
  const { toast } = useToast();
  const [restaurantRating, setRestaurantRating] = useState(0);
  const [driverRating, setDriverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (restaurantRating === 0 && driverRating === 0) {
      toast({
        title: "Rating required",
        description: "Please rate at least the restaurant or the driver.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit restaurant review
      if (restaurantRating > 0) {
        await apiRequest(
          `/api/restaurants/${restaurantId}/review/`,
          "POST",
          {
            order_id: orderId,
            rating: restaurantRating,
            comment,
          }
        );
      }

      // Submit driver rating (existing endpoint)
      if (driverRating > 0 && driverId) {
        await apiRequest("/api/drivers/rate/driver/", "POST", {
          driver_id: driverId,
          rating: driverRating,
          comment: "",
        });
      }

      toast({
        title: "Thanks for your feedback!",
        description: "Your rating has been submitted.",
      });
      onClose();
    } catch (err: any) {
      // If the error is about duplicate review, still show success
      if (err?.message?.includes("already reviewed")) {
        toast({
          title: "Already reviewed",
          description: "You have already reviewed this order.",
        });
        onClose();
      } else {
        toast({
          title: "Submission failed",
          description: "Could not submit your rating. Please try again.",
          variant: "destructive",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    // Reset state on close
    setRestaurantRating(0);
    setDriverRating(0);
    setComment("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>How was your order?</DialogTitle>
          <DialogDescription>
            Rate your experience to help others and improve service.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          {/* Restaurant rating */}
          <StarSelector
            value={restaurantRating}
            onChange={setRestaurantRating}
            label={`Rate ${restaurantName}`}
          />

          {/* Driver rating */}
          {driverName && (
            <StarSelector
              value={driverRating}
              onChange={setDriverRating}
              label={`Rate your driver: ${driverName}`}
            />
          )}

          {/* Optional comment */}
          <div>
            <p className="text-sm font-medium text-foreground mb-2">
              Comment (optional)
            </p>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Tell us about your experience..."
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Skip
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
          >
            {isSubmitting ? "Submitting..." : "Submit Rating"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
