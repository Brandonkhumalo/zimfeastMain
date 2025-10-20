import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardContent } from "@/components/ui/card"; 

interface OrdersSectionProps {
  orders: any[];
  updateOrder: (orderId: string, status: string) => void;
}

export default function OrdersSection({ orders, updateOrder }: OrdersSectionProps) {
  const [selectedStatus, setSelectedStatus] = useState("");

  const filteredOrders = orders.filter(o => !selectedStatus || o.status === selectedStatus);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "accepted":
      case "preparing": return "bg-blue-100 text-blue-800";
      case "ready": return "bg-green-100 text-green-800";
      case "delivered": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Live Orders</h3>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-muted-foreground">Real-time</span>
          </div>
        </div>
        <div className="flex space-x-2 mt-4">
          {["", "pending", "preparing"].map(status => (
            <Button
              key={status}
              variant={selectedStatus === status ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedStatus(status)}
            >
              {status === "" ? "All" : status.charAt(0).toUpperCase() + status.slice(1)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8">
              <i className="fas fa-receipt text-4xl text-muted-foreground mb-4"></i>
              <p className="text-muted-foreground">No orders found</p>
            </div>
          ) : filteredOrders.map(order => (
            <div key={order.id} className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-primary font-medium">#{order.id.slice(-3)}</span>
                  </div>
                  <div>
                    <p className="font-medium">{order.customerPhone}</p>
                    <p className="text-sm text-muted-foreground">{order.createdAt ? new Date(order.createdAt).toLocaleTimeString() : 'N/A'}</p>
                  </div>
                </div>
                <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
              </div>
              <div className="text-sm text-muted-foreground mb-3">
                {Array.isArray(order.items) ? order.items.map((i: any) => `${i.quantity}x ${i.name}`).join(", ") : "Order items"}
              </div>
              <div className="flex items-center justify-between">
                <span className="font-medium">${order.total}</span>
                <div className="flex space-x-2">
                  {order.status === "pending" && <Button size="sm" onClick={() => updateOrder(order.id, "accepted")}>Accept</Button>}
                  {order.status === "accepted" && <Button size="sm" onClick={() => updateOrder(order.id, "preparing")}>Start Preparing</Button>}
                  {order.status === "preparing" && <Button size="sm" className="bg-accent hover:bg-accent/90" onClick={() => updateOrder(order.id, "ready")}>Ready</Button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
