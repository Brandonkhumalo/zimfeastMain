import { useState, useEffect, useRef, useCallback } from "react";

interface OrderData {
  id: string;
  status: string;
  method: string;
  restaurant_names: string;
  restaurant_id?: string;
  driver_name?: string;
  driver_phone?: string;
  driver_vehicle?: string;
  driver_id?: string;
  created: string;
  delivery_address?: string;
}

/** Information about an order that was just delivered — used to trigger the rating dialog. */
export interface DeliveredOrder {
  orderId: string;
  restaurantId: string;
  restaurantName: string;
  driverName: string;
  driverId?: string;
}

interface UseActiveOrderParams {
  isAuthenticated: boolean;
}

export function useActiveOrder({ isAuthenticated }: UseActiveOrderParams) {
  const [activeOrder, setActiveOrder] = useState<OrderData | null>(null);
  const [isTrackingOpen, setIsTrackingOpen] = useState(false);

  // Tracks the most recently delivered order so the rating dialog can be shown.
  const [deliveredOrder, setDeliveredOrder] = useState<DeliveredOrder | null>(null);

  // Keep a ref to the previous active order ID + status so we can detect
  // transitions to "delivered".
  const prevOrderRef = useRef<{ id: string; status: string } | null>(null);

  const fetchActiveOrder = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch('/api/orders/list/', {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) return;
      const orders: OrderData[] = await res.json();

      // Check if an order that was previously active has now been delivered.
      const prev = prevOrderRef.current;
      if (prev && prev.status !== "delivered") {
        const justDelivered = orders.find(
          (o) => o.id === prev.id && o.status === "delivered"
        );
        if (justDelivered) {
          setDeliveredOrder({
            orderId: justDelivered.id,
            restaurantId: justDelivered.restaurant_id || "",
            restaurantName: justDelivered.restaurant_names || "Restaurant",
            driverName: justDelivered.driver_name || "",
            driverId: justDelivered.driver_id,
          });
        }
      }

      const active = orders.find(o =>
        !['delivered', 'collected', 'cancelled'].includes(o.status)
      );
      setActiveOrder(active || null);

      // Update the ref for next comparison
      prevOrderRef.current = active
        ? { id: active.id, status: active.status }
        : null;
    } catch (err) {
      console.log("No active orders");
    }
  }, []);

  // Poll for active orders every 30 seconds
  useEffect(() => {
    if (isAuthenticated) {
      fetchActiveOrder();
      const interval = setInterval(fetchActiveOrder, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, fetchActiveOrder]);

  /** Called by the parent component after the rating dialog is closed/submitted. */
  const clearDeliveredOrder = useCallback(() => {
    setDeliveredOrder(null);
  }, []);

  return {
    activeOrder,
    isTrackingOpen,
    setIsTrackingOpen,
    deliveredOrder,
    clearDeliveredOrder,
  };
}
