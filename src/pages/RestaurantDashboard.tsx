// src/pages/RestaurantDashboard.tsx
import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import DashboardLayout from "./restaurant-components/DashboardLayout";
import DashboardHeader from "./restaurant-components/DashboardHeader";
import StatsCards from "./restaurant-components/StatsCards";
import LiveOrders from "./restaurant-components/LiveOrders";
import MenuManagement from "./restaurant-components/MenuManagement";
import ExternalAPIDialog from "./restaurant-components/ExternalAPIDialog";

// -------------------
// Types
// -------------------
type OrderItem = { id: string; name: string; quantity: number; price?: number };
type Order = {
  id: string;
  customerPhone?: string;
  createdAt?: string;
  items?: OrderItem[];
  total?: number;
  total_fee?: number;
  status: string;
};
type OrdersPage = {
  next: string | null;
  previous: string | null;
  results: Order[];
};

// -------------------
// REST API helpers
// -------------------
const getAuthHeaders = () => {
  const token = localStorage.getItem("token");
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const fetchOrdersPage = async (url: string): Promise<OrdersPage> => {
  const res = await fetch(url, { headers: getAuthHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch orders");
  }
  return await res.json();
};

const fetchMenuItems = async (restaurantId: number) => {
  const res = await fetch(`/api/restaurants/${restaurantId}/menu-items/`, { headers: getAuthHeaders() });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to fetch menu items");
  }
  return await res.json();
};

// Calls backend endpoints to update order. statusArg must be "preparing" or "completed".
const updateOrderStatusRest = async (orderId: string, statusArg: "preparing" | "completed") => {
  const url = `/api/orders/${orderId}/${statusArg}/`;
  const res = await fetch(url, {
    method: "POST",
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to update order status");
  }
  return res.json();
};

// -------------------
// Main Component
// -------------------
export default function RestaurantDashboard() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  const [dashboardData, setDashboardData] = useState({
    restaurantName: "",
    todayOrders: 0,
    todayRevenue: 0,
    avgRating: 0,
    preparing: 0,
    pending: 0,
    completed: 0,
  });

  const [ordersData, setOrdersData] = useState<OrdersPage>({
    next: null,
    previous: null,
    results: [],
  });

  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isExternalAPIDialogOpen, setIsExternalAPIDialogOpen] = useState(false);

  // preserve websocket instance in ref so handlers can access state safely
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const restaurantId =
    // try common shapes: user.restaurantId, user.restaurant_id, fallback to user.id (not ideal)
    (user as any)?.restaurantId ?? (user as any)?.restaurant_id ?? (user as any)?.restaurant?.id ?? (user as any)?.id;

  // Auth redirect: if not authenticated, go to login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "Logging in...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 500);
    }
  }, [isAuthenticated, isLoading, toast]);

  // Load initial data once restaurantId is known
  useEffect(() => {
    if (!restaurantId) return;

    const loadDashboardData = async () => {
      try {
        // initial orders page (use a dedicated endpoint)
        const ordersResponse = await fetchOrdersPage("/api/orders/list/");
        setOrdersData(ordersResponse);

        // derive stats from loaded orders (fallback / initial)
        const todayOrders = ordersResponse.results.length;
        const todayRevenue = ordersResponse.results.reduce((acc: number, o: any) => acc + (o.total_fee ?? o.total ?? 0), 0);

        setDashboardData((prev) => ({
          ...prev,
          restaurantName: (user as any)?.restaurant_name ?? "My Restaurant",
          todayOrders,
          todayRevenue,
        }));

        // load menu items
        const menuRes = await fetchMenuItems(Number(restaurantId));
        setMenuItems(menuRes);
      } catch (err: any) {
        toast({
          title: "Error",
          description: err.message || "Failed to load dashboard data",
          variant: "destructive",
        });
      }
    };

    loadDashboardData();
  }, [restaurantId, toast, user]);

  // Pagination handlers
  const handleNext = async () => {
    if (!ordersData.next) return;
    try {
      const nextPage = await fetchOrdersPage(ordersData.next);
      setOrdersData(nextPage);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to fetch next page", variant: "destructive" });
    }
  };

  const handlePrevious = async () => {
    if (!ordersData.previous) return;
    try {
      const prevPage = await fetchOrdersPage(ordersData.previous);
      setOrdersData(prevPage);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to fetch previous page", variant: "destructive" });
    }
  };

  // Helper to merge/update an order inside ordersData.results
  const upsertOrder = useCallback((order: Order) => {
    setOrdersData((prev) => {
      const exists = prev.results.some((o) => o.id === order.id);
      let newResults = exists ? prev.results.map((o) => (o.id === order.id ? { ...o, ...order } : o)) : [order, ...prev.results];
      return { ...prev, results: newResults };
    });
  }, []);

  // Update order via REST, called when user clicks UI actions
  const handleUpdateOrder = async (orderId: string, status: "preparing" | "completed") => {
    // optimistic UI update
    setOrdersData((prev) => ({
      ...prev,
      results: prev.results.map((o) => (o.id === orderId ? { ...o, status } : o)),
    }));

    try {
      const resp = await updateOrderStatusRest(orderId, status);
      // backend may return updated order object; upsert it
      if (resp && typeof resp === "object") {
        upsertOrder(resp as Order);
      }
      // optionally show toast
      toast({ title: "Order updated", description: `Order ${orderId} set to ${status}`, variant: "default" });
    } catch (err: any) {
      // revert optimistic update when error
      setOrdersData((prev) => ({
        ...prev,
        results: prev.results.map((o) => (o.id === orderId ? { ...o, status: o.status } : o)),
      }));
      toast({ title: "Error", description: err.message || "Failed to update order", variant: "destructive" });
    }
  };

  // -------------------
  // WebSocket connection for live orders + stats
  // -------------------
  useEffect(() => {
    if (!restaurantId) return;

    const connect = () => {
      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      // make sure backend path matches your Channels consumer route
      const wsUrl = `${protocol}://${window.location.host}/ws/restaurants/${restaurantId}/dashboard/`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.info("Dashboard WS connected");
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);

          // Stats update
          if (payload.today_orders !== undefined || payload.today_revenue !== undefined || payload.today_average_rating !== undefined) {
            setDashboardData((prev) => ({
              ...prev,
              todayOrders: payload.today_orders ?? prev.todayOrders,
              todayRevenue: payload.today_revenue ?? prev.todayRevenue,
              avgRating: payload.today_average_rating ?? prev.avgRating,
              preparing: payload.preparing ?? prev.preparing,
              pending: payload.pending ?? prev.pending,
              completed: payload.completed ?? prev.completed,
            }));
          }

          // New order: add to head of list
          if (payload.new_order) {
            upsertOrder(payload.new_order as Order);
          }

          // Updated order: update inside list
          if (payload.updated_order) {
            upsertOrder(payload.updated_order as Order);
          }
        } catch (e) {
          console.error("WS message parse error", e);
        }
      };

      ws.onclose = (ev) => {
        console.warn("Dashboard WS closed", ev);
        // attempt reconnect with backoff
        const tries = reconnectAttemptsRef.current;
        const delay = Math.min(1000 * 2 ** tries, 30000); // cap 30s
        reconnectAttemptsRef.current += 1;
        setTimeout(() => connect(), delay);
      };

      ws.onerror = (err) => {
        console.error("Dashboard WS error", err);
        ws.close();
      };
    };

    connect();

    // cleanup on unmount
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [restaurantId, upsertOrder]);

  return (
    <DashboardLayout>
      <DashboardHeader restaurantName={dashboardData.restaurantName} />

      <main className="max-w-7xl mx-auto p-4 space-y-8">
        {/* External API Button */}
        <div className="flex justify-end">
          <button
            onClick={() => setIsExternalAPIDialogOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg shadow-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <i className="fas fa-plug"></i>
            <span className="font-semibold">External APIs</span>
          </button>
        </div>

        <StatsCards
          todayOrders={dashboardData.todayOrders}
          todayRevenue={dashboardData.todayRevenue}
          avgRating={dashboardData.avgRating}
          menuItemsCount={menuItems.length}
        />

        <section>
          <h2 className="text-xl font-bold mb-4">Live Orders</h2>
          <LiveOrders
            orders={ordersData.results}
            selectedStatus={selectedStatus}
            setSelectedStatus={setSelectedStatus}
            updateOrder={(orderId: string, status: string) => {
              // map "preparing" and "completed" to REST calls
              if (status === "preparing") handleUpdateOrder(orderId, "preparing");
              else if (status === "completed") handleUpdateOrder(orderId, "completed");
              else {
                // handle other status changes if needed
                handleUpdateOrder(orderId, status as any);
              }
            }}
          />

          <div className="flex justify-between mt-4">
            <button
              onClick={handlePrevious}
              disabled={!ordersData.previous}
              className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
            >
              Previous 10
            </button>
            <button
              onClick={handleNext}
              disabled={!ordersData.next}
              className="px-4 py-2 bg-gray-300 rounded disabled:opacity-50"
            >
              Next 10
            </button>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">Menu Management</h2>
          <MenuManagement
            handleAddItem={() => setIsAddDialogOpen(true)}
            isAddDialogOpen={isAddDialogOpen}
            setIsAddDialogOpen={setIsAddDialogOpen}
          />
        </section>
      </main>

      {/* External API Dialog */}
      <ExternalAPIDialog
        isOpen={isExternalAPIDialogOpen}
        onClose={() => setIsExternalAPIDialogOpen(false)}
        restaurantId={restaurantId}
      />
    </DashboardLayout>
  );
}
