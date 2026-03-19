interface LiveOrdersProps {
  orders?: any[];
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  updateOrder: (orderId: string, status: string) => void;
}

export default function LiveOrders({
  orders = [],
  selectedStatus,
  setSelectedStatus,
  updateOrder,
}: LiveOrdersProps) {
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
      <div className="flex flex-wrap gap-2 mb-4">
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
              className="border border-border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow"
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

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xl font-bold text-primary">
                    ${Number(order.total_fee || order.total || 0).toFixed(2)}
                  </span>
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
