interface LiveOrdersProps {
  orders?: any[]; // make optional
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  updateOrder: (orderId: string, status: string) => void;
}

export default function LiveOrders({
  orders = [], // ✅ default to empty array
  selectedStatus,
  setSelectedStatus,
  updateOrder,
}: LiveOrdersProps) {
  const filteredOrders = orders.filter(
    (order) => !selectedStatus || order.status === selectedStatus
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "accepted":
      case "preparing":
        return "bg-blue-100 text-blue-800";
      case "ready":
        return "bg-green-100 text-green-800";
      case "delivered":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div>
      <div className="flex space-x-2 mb-4">
        {["", "pending", "preparing"].map((status) => (
          <button
            key={status}
            className={`px-3 py-1 rounded ${
              selectedStatus === status ? "bg-primary text-white" : "border"
            }`}
            onClick={() => setSelectedStatus(status)}
          >
            {status === "" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredOrders.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <i className="fas fa-receipt text-4xl mb-4"></i>
            No orders found
          </div>
        )}

        {filteredOrders.map((order) => (
          <div
            key={order.id}
            className="border border-border rounded-lg p-4 cursor-pointer hover:bg-gray-50"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <span className="text-primary font-medium">
                    #{order.id ? order.id.slice(-3) : "N/A"}
                  </span>
                </div>
                <div>
                  <p className="font-medium">{order.customerPhone || "Unknown"}</p>
                  <p className="text-sm text-muted-foreground">
                    {order.createdAt
                      ? new Date(order.createdAt).toLocaleTimeString()
                      : "N/A"}
                  </p>
                </div>
              </div>
              <span
                className={`px-2 py-1 rounded text-xs ${getStatusColor(order.status)}`}
              >
                {order.status}
              </span>
            </div>

            <div className="text-sm text-muted-foreground mb-3">
              {Array.isArray(order.items)
                ? order.items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ")
                : "Order items"}
            </div>

            <div className="flex items-center justify-between">
              <span className="font-medium">${order.total || "0.00"}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
