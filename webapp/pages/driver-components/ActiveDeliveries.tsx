import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Order } from "./types";

interface ActiveDeliveriesProps {
  activeDeliveries: Order[];
  assignedOrder: Order | null;
}

export default function ActiveDeliveries({activeDeliveries,assignedOrder,}: ActiveDeliveriesProps) {
  const deliveries = assignedOrder ? [assignedOrder, ...activeDeliveries] : activeDeliveries;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Deliveries</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {deliveries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active deliveries
          </div>
        ) : (
          deliveries.map((order) => {
            // Determine badge text based on status
            const badgeText =
              order.status.charAt(0).toUpperCase() + order.status.slice(1);

            return (
              <div
                key={order.id}
                className="border-l-4 border-accent pl-4 bg-accent/5 rounded-r-lg p-4">
                <div className="flex justify-between mb-2 items-center">
                  <p className="font-medium">Order #{order.id.slice(-6)}</p>
                  <Badge className="bg-accent text-accent-foreground flex items-center justify-center text-center px-3 py-1">
                    {badgeText}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-2">
                  Address: {order.deliveryAddress}
                </p>
                <div className="flex justify-between items-center">
                  <span>Delivery Fee: ${order.deliveryFee}</span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
