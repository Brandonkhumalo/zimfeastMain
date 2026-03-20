import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Restaurant } from "@shared/schema";
import { calculateDeliveryFeeFromCoordinates, DEFAULT_DELIVERY_FEE } from "@shared/deliveryUtils";
import AddressBook, { type SavedAddress } from "@/components/AddressBook";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  restaurantId?: string;
  restaurantName?: string;
}

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  currency: string;
  userLocation?: {lat: number, lng: number} | null;
}

export default function Cart({ isOpen, onClose, items, onUpdateQuantity, currency, userLocation }: CartProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const getCurrencySymbol = (curr: string) => curr === 'USD' ? '$' : 'Z$';

  // ── Address selection state ─────────────────────────────────────────
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [useCurrentLoc, setUseCurrentLoc] = useState(true); // default to current location

  // ── Schedule order state ────────────────────────────────────────────
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");

  // The effective delivery location: either a saved address or the browser location
  const effectiveLocation = useCurrentLoc
    ? userLocation
    : selectedAddress
      ? { lat: selectedAddress.lat, lng: selectedAddress.lng }
      : null;

  const effectiveAddressText = useCurrentLoc
    ? "Current Location"
    : selectedAddress?.address_text ?? "";

  // Get unique restaurant IDs from cart items
  const restaurantIds = Array.from(new Set(items.map(item => item.restaurantId).filter(Boolean) as string[]));

  // Fetch restaurant data for delivery fee calculation
  const { data: restaurants } = useQuery<Restaurant[]>({
    queryKey: ['/api/restaurants'],
    enabled: restaurantIds.length > 0,
  });

  // Calculate delivery fee based on distance to restaurants
  const getDeliveryFee = (): number => {
    if (!effectiveLocation || !restaurants || restaurants.length === 0) {
      return DEFAULT_DELIVERY_FEE;
    }

    let maxDeliveryFee = 1.50;

    restaurantIds.forEach(restaurantId => {
      const restaurant = restaurants.find(r => r.id === restaurantId);
      if (restaurant) {
        const restaurantLat = (restaurant as any).lat ?? (restaurant.coordinates as any)?.lat;
        const restaurantLng = (restaurant as any).lng ?? (restaurant.coordinates as any)?.lng;
        if (restaurantLat && restaurantLng) {
          const fee = calculateDeliveryFeeFromCoordinates(
            effectiveLocation.lat,
            effectiveLocation.lng,
            restaurantLat,
            restaurantLng
          );
          maxDeliveryFee = Math.max(maxDeliveryFee, fee);
        }
      }
    });

    return maxDeliveryFee;
  };

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;

  // Build an ISO 8601 datetime string from the date + time inputs
  const getScheduledForISO = (): string | null => {
    if (scheduleMode !== "later" || !scheduledDate || !scheduledTime) return null;
    // Combine date and time into a local datetime and convert to ISO string
    const combined = new Date(`${scheduledDate}T${scheduledTime}`);
    if (isNaN(combined.getTime())) return null;
    return combined.toISOString();
  };

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!effectiveLocation) {
        throw new Error('Delivery location is required. Select an address or use current location.');
      }

      const firstRestaurantId = restaurantIds[0];
      if (!firstRestaurantId) {
        throw new Error('No restaurant selected');
      }

      const restaurantItems = items.filter(item => item.restaurantId === firstRestaurantId);

      const orderData: any = {
        restaurantId: firstRestaurantId,
        items: restaurantItems.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal: restaurantItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toString(),
        deliveryCoordinates: effectiveLocation,
        deliveryAddress: effectiveAddressText,
        currency,
        status: 'pending' as const,
      };

      // If scheduling for later, add the scheduled_for field
      const scheduledFor = getScheduledForISO();
      if (scheduledFor) {
        orderData.scheduled_for = scheduledFor;
      }

      return await apiRequest('/api/orders', 'POST', orderData);
    },
    onSuccess: (order: any) => {
      const isScheduled = scheduleMode === "later";
      toast({
        title: isScheduled ? "Order Scheduled" : "Order Created",
        description: isScheduled
          ? "Your order has been scheduled. You'll be notified when it's time to pay."
          : "Redirecting to payment...",
      });

      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });

      if (!isScheduled) {
        setLocation(`/checkout?orderId=${order.id}`);
      }
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Unable to create order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCheckout = () => {
    if (items.length === 0) return;

    if (!effectiveLocation) {
      toast({
        title: "Location Required",
        description: "Please select a saved address or use your current location.",
        variant: "destructive",
      });
      return;
    }

    if (restaurantIds.length > 1) {
      toast({
        title: "Multiple Restaurants",
        description: "Please order from one restaurant at a time.",
        variant: "destructive",
      });
      return;
    }

    // Validate schedule time if scheduling
    if (scheduleMode === "later") {
      const scheduledFor = getScheduledForISO();
      if (!scheduledFor) {
        toast({
          title: "Schedule Required",
          description: "Please select both a date and time for your scheduled order.",
          variant: "destructive",
        });
        return;
      }
      if (new Date(scheduledFor) <= new Date()) {
        toast({
          title: "Invalid Time",
          description: "Scheduled time must be in the future.",
          variant: "destructive",
        });
        return;
      }
    }

    createOrderMutation.mutate();
  };

  // Helper to get minimum date (today) for the date picker
  const getMinDate = () => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  };

  // Helper to get minimum time if the selected date is today
  const getMinTime = () => {
    if (!scheduledDate) return undefined;
    const today = new Date().toISOString().split("T")[0];
    if (scheduledDate === today) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30); // at least 30 minutes from now
      return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    }
    return undefined;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Sidebar */}
      <div className="ml-auto w-96 bg-white dark:bg-gray-900 shadow-xl border-l border-border h-full flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white" data-testid="text-cart-title">Your Cart</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-testid="button-close-cart"
          >
            <i className="fas fa-times text-xl"></i>
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-shopping-cart text-4xl text-gray-400 dark:text-gray-500 mb-4"></i>
              <p className="text-gray-500 dark:text-gray-400" data-testid="text-empty-cart">Your cart is empty</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Add items from a restaurant to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Cart Items */}
              {items.map((item) => (
                <Card key={item.id} className="p-4 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900 dark:text-white" data-testid={`text-item-name-${item.id}`}>
                        {item.name}
                      </h4>
                      {item.restaurantName && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {item.restaurantName}
                        </p>
                      )}
                      <p className="text-sm font-medium mt-1 text-orange-600 dark:text-orange-400" data-testid={`text-item-price-${item.id}`}>
                        {getCurrencySymbol(currency)}{item.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-300 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        data-testid={`button-decrease-${item.id}`}
                      >
                        -
                      </Button>
                      <span className="px-2 text-gray-900 dark:text-white" data-testid={`text-quantity-${item.id}`}>
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-gray-300 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        data-testid={`button-increase-${item.id}`}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              {/* ── Delivery Address Section ─────────────────────────── */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  <i className="fas fa-map-marker-alt text-orange-500 mr-2"></i>
                  Delivery Address
                </h4>

                {/* Toggle: Current Location vs Saved Address */}
                <div className="flex gap-2 mb-3">
                  <Button
                    variant={useCurrentLoc ? "default" : "outline"}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => { setUseCurrentLoc(true); setSelectedAddress(null); }}
                    data-testid="button-use-current-location-toggle"
                  >
                    <i className="fas fa-crosshairs mr-1"></i> Current Location
                  </Button>
                  <Button
                    variant={!useCurrentLoc ? "default" : "outline"}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setUseCurrentLoc(false)}
                    data-testid="button-use-saved-address-toggle"
                  >
                    <i className="fas fa-bookmark mr-1"></i> Saved Address
                  </Button>
                </div>

                {useCurrentLoc ? (
                  <div className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    {userLocation ? (
                      <div className="flex items-center gap-2">
                        <i className="fas fa-check-circle text-green-500"></i>
                        <span>Using your current location</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>Location not available. Please enable location access.</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <AddressBook
                    compact
                    selectedId={selectedAddress?.id ?? null}
                    onSelect={(addr) => setSelectedAddress(addr)}
                  />
                )}
              </div>

              {/* ── Schedule Order Section ────────────────────────────── */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  <i className="fas fa-clock text-orange-500 mr-2"></i>
                  When do you want your order?
                </h4>

                <div className="flex gap-2 mb-3">
                  <Button
                    variant={scheduleMode === "now" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setScheduleMode("now")}
                    data-testid="button-order-now"
                  >
                    Order Now
                  </Button>
                  <Button
                    variant={scheduleMode === "later" ? "default" : "outline"}
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setScheduleMode("later")}
                    data-testid="button-schedule-later"
                  >
                    <i className="fas fa-calendar-alt mr-1"></i> Schedule for Later
                  </Button>
                </div>

                {scheduleMode === "later" && (
                  <div className="space-y-2 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
                    <div>
                      <Label htmlFor="schedule-date" className="text-xs text-gray-600 dark:text-gray-400">Date</Label>
                      <Input
                        id="schedule-date"
                        type="date"
                        min={getMinDate()}
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        className="mt-1"
                        data-testid="input-schedule-date"
                      />
                    </div>
                    <div>
                      <Label htmlFor="schedule-time" className="text-xs text-gray-600 dark:text-gray-400">Time</Label>
                      <Input
                        id="schedule-time"
                        type="time"
                        min={getMinTime()}
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="mt-1"
                        data-testid="input-schedule-time"
                      />
                    </div>
                    {scheduledDate && scheduledTime && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                        <i className="fas fa-check-circle mr-1"></i>
                        Scheduled for {new Date(`${scheduledDate}T${scheduledTime}`).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border p-6 bg-white dark:bg-gray-900">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-gray-700 dark:text-gray-300">
                <span>Subtotal</span>
                <span data-testid="text-subtotal">
                  {getCurrencySymbol(currency)}{subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-gray-700 dark:text-gray-300">
                <span>Delivery Fee</span>
                <span data-testid="text-delivery-fee">
                  {getCurrencySymbol(currency)}{deliveryFee.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t border-gray-200 dark:border-gray-700 pt-2 text-gray-900 dark:text-white">
                <span>Total</span>
                <span data-testid="text-total">
                  {getCurrencySymbol(currency)}{total.toFixed(2)}
                </span>
              </div>
            </div>
            <Button
              className="w-full"
              onClick={handleCheckout}
              disabled={createOrderMutation.isPending}
              data-testid="button-checkout"
            >
              {createOrderMutation.isPending
                ? 'Creating Order...'
                : scheduleMode === "later"
                  ? `Schedule Order (${getCurrencySymbol(currency)}${total.toFixed(2)})`
                  : `Proceed to Checkout (${getCurrencySymbol(currency)}${total.toFixed(2)})`
              }
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
