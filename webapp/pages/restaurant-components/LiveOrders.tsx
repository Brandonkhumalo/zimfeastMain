import { useState, useEffect, useRef } from "react";
import PrepTimer from "./PrepTimer";
import { printReceipt } from "./PrintableReceipt";

// --- Sound alert: generates a pleasant ascending chime using Web Audio API ---
const playOrderChime = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const playTone = (freq: number, startTime: number, duration: number) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = "sine";
      gain.gain.setValueAtTime(0.3, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
      osc.start(startTime);
      osc.stop(startTime + duration);
    };
    const now = audioCtx.currentTime;
    playTone(523.25, now, 0.15);        // C5
    playTone(659.25, now + 0.15, 0.15); // E5
    playTone(783.99, now + 0.3, 0.3);   // G5
  } catch {
    // Web Audio API not available — silently ignore
  }
};

// localStorage key for mute preference
const MUTE_STORAGE_KEY = "zimfeast_order_alert_muted";

interface LiveOrdersProps {
  orders?: any[];
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  updateOrder: (orderId: string, status: string) => void;
  highlightedOrderIds?: Set<string>;
}

export default function LiveOrders({
  orders = [],
  selectedStatus,
  setSelectedStatus,
  updateOrder,
  highlightedOrderIds = new Set(),
}: LiveOrdersProps) {
  // --- Sound mute toggle (persisted in localStorage) ---
  const [isMuted, setIsMuted] = useState<boolean>(() => {
    try {
      return localStorage.getItem(MUTE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const toggleMute = () => {
    setIsMuted((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(MUTE_STORAGE_KEY, String(next));
      } catch {}
      return next;
    });
  };

  // --- Detect new orders arriving and trigger sound + flash ---
  const prevOrderCountRef = useRef<number>(orders.length);
  const [flashingOrderIds, setFlashingOrderIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const prevCount = prevOrderCountRef.current;
    const currentCount = orders.length;

    if (currentCount > prevCount && prevCount > 0) {
      // New orders detected — the newest orders are at the front of the array
      const newCount = currentCount - prevCount;
      const newOrders = orders.slice(0, newCount);

      // Play chime if not muted
      if (!isMuted) {
        playOrderChime();
      }

      // Add new order IDs to flashing set for visual pulse
      const newIds = new Set(newOrders.map((o) => o.id));
      setFlashingOrderIds((prev) => new Set([...prev, ...newIds]));

      // Remove flash after 2 seconds (3 pulses at ~0.67s each)
      setTimeout(() => {
        setFlashingOrderIds((prev) => {
          const next = new Set(prev);
          newIds.forEach((id) => next.delete(id));
          return next;
        });
      }, 2000);
    }

    prevOrderCountRef.current = currentCount;
  }, [orders.length, orders, isMuted]);

  const filteredOrders = orders.filter((order) => {
    if (!selectedStatus) return true;
    if (selectedStatus === "pending") {
      return order.status === "paid" || order.status === "created" || order.status === "pending";
    }
    return order.status === selectedStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
      case "paid":
      case "created":
        return "bg-yellow-100 text-yellow-800";
      case "accepted":
      case "preparing":
        return "bg-blue-100 text-blue-800";
      case "ready":
        return "bg-green-100 text-green-800";
      case "delivered":
      case "completed":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "paid":
      case "created":
        return "Pending";
      case "ready":
        return "Ready for Collection";
      case "completed":
        return "Completed";
      default:
        return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const getActionButton = (order: any) => {
    const status = order.status;
    const isCollection = order.method === "collection";
    
    if (status === "paid" || status === "created" || status === "pending") {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateOrder(order.id, "preparing");
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          Start Preparing
        </button>
      );
    }
    if (status === "preparing") {
      return (
        <button
          onClick={(e) => {
            e.stopPropagation();
            updateOrder(order.id, "ready");
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium text-sm"
        >
          Mark Ready
        </button>
      );
    }
    if (status === "ready") {
      if (isCollection) {
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              updateOrder(order.id, "collected");
            }}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm"
          >
            Mark Collected
          </button>
        );
      }
      return (
        <span className="px-4 py-2 bg-green-100 text-green-800 rounded-lg font-medium text-sm">
          Awaiting Delivery
        </span>
      );
    }
    if (status === "collected") {
      return (
        <span className="px-4 py-2 bg-gray-100 text-gray-800 rounded-lg font-medium text-sm">
          Collected
        </span>
      );
    }
    return null;
  };

  const getOrderItems = (order: any) => {
    if (Array.isArray(order.items) && order.items.length > 0) {
      return order.items;
    }
    if (order.each_item_price && Array.isArray(order.each_item_price)) {
      return order.each_item_price;
    }
    return [];
  };

  return (
    <div>
      {/* CSS keyframe animation for new order pulse flash */}
      <style>{`
        @keyframes newOrderPulse {
          0% { background-color: inherit; }
          25% { background-color: rgb(251 191 36 / 0.35); }
          50% { background-color: inherit; }
          75% { background-color: rgb(251 191 36 / 0.35); }
          100% { background-color: inherit; }
        }
        .new-order-flash {
          animation: newOrderPulse 0.67s ease-in-out 3;
          border-color: rgb(245 158 11) !important;
          box-shadow: 0 0 12px rgb(245 158 11 / 0.4);
        }
      `}</style>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {/* Sound toggle button */}
        <button
          onClick={toggleMute}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg font-medium text-sm transition-colors border ${
            isMuted
              ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
              : "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
          }`}
          title={isMuted ? "Unmute order alerts" : "Mute order alerts"}
        >
          {isMuted ? (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <line x1="23" y1="9" x2="17" y2="15" />
              <line x1="17" y1="9" x2="23" y2="15" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
          )}
          {isMuted ? "Muted" : "Sound On"}
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1" />

        {[
          { value: "", label: "All" },
          { value: "pending", label: "Pending" },
          { value: "preparing", label: "Preparing" },
          { value: "ready", label: "Ready" },
        ].map((tab) => (
          <button
            key={tab.value}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedStatus === tab.value
                ? "bg-primary text-white"
                : "border border-gray-300 hover:bg-gray-100"
            }`}
            onClick={() => setSelectedStatus(tab.value)}
          >
            {tab.label}
            {tab.value && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">
                {orders.filter((o) => {
                  if (tab.value === "pending") return o.status === "paid" || o.status === "created" || o.status === "pending";
                  return o.status === tab.value;
                }).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <i className="fas fa-receipt text-4xl mb-4 block"></i>
            <p>No orders found</p>
          </div>
        )}

        {filteredOrders.map((order) => {
          const items = getOrderItems(order);
          return (
            <div
              key={order.id}
              className={`border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-all duration-300 ${
                highlightedOrderIds.has(order.id)
                  ? "border-orange-500 border-2 bg-orange-50 animate-pulse ring-2 ring-orange-300"
                  : flashingOrderIds.has(order.id)
                  ? "new-order-flash border-2"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-primary font-bold text-lg">
                      #{order.id ? order.id.slice(-4).toUpperCase() : "N/A"}
                    </span>
                  </div>
                  <div>
                    <p className="font-bold text-xl">Order #{order.id ? order.id.slice(-4).toUpperCase() : "N/A"}</p>
                    <p className="text-sm text-muted-foreground">
                      {order.createdAt || order.created
                        ? new Date(order.createdAt || order.created).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(order.status)}`}
                  >
                    {getStatusLabel(order.status)}
                  </span>
                  {order.method && (
                    <span className="text-sm text-gray-600 font-medium">
                      {order.method === "delivery" ? "🚗 Delivery" : "🏪 Collection"}
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-4 bg-gray-50 p-3 rounded border">
                <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Order Items</p>
                {items.length > 0 ? (
                  <ul className="space-y-1">
                    {items.map((item: any, idx: number) => (
                      <li key={idx} className="flex justify-between text-sm">
                        <span className="font-medium">
                          {item.quantity}x {item.name || item.menu_item_name || "Item"}
                        </span>
                        {item.price && (
                          <span className="text-gray-600">${(item.price * item.quantity).toFixed(2)}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-400 italic">No items listed</p>
                )}
              </div>

              {/* Preparation timer for orders being prepared */}
              {order.status === "preparing" && (order.preparing_started_at || order.preparingStartedAt) && (
                <div className="mb-3">
                  <PrepTimer
                    preparingStartedAt={order.preparing_started_at || order.preparingStartedAt}
                    totalPrepTimeMinutes={order.prep_time || 20}
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-bold text-primary">
                    ${Number(order.total_fee || order.total || 0).toFixed(2)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      printReceipt(order);
                    }}
                    className="px-3 py-1.5 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors text-sm"
                    title="Print receipt"
                  >
                    <i className="fas fa-print mr-1"></i>
                    Print
                  </button>
                </div>
                {getActionButton(order)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
