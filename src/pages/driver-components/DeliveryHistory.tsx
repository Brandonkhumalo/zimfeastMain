import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDriverOrderHistory } from "./apiRequest";
import { Order } from "./types";

export default function DeliveryHistory() {
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["driver-order-history", cursor],
    queryFn: async () => {
      const res = await getDriverOrderHistory(cursor || "");
      setNextCursor(res.next);
      setPrevCursor(res.previous);
      return res.results.map((o) => ({
        id: o.id,
        status: o.status,
        deliveryFee: o.fee,
        deliveryAddress: o.location || "",
        orderDate: o.completed_at,
      }));
    },
  });

  if (isLoading)
    return (
      <div className="flex justify-center py-6">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );

  const deliveries = data || [];

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Delivery History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {deliveries.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No Deliveries made
          </div>
        ) : (
          deliveries.map((order) => {
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
                <p className="text-sm text-muted-foreground mb-2">
                  Date: {order.orderDate}
                </p>
                <div className="flex justify-between items-center">
                  <span>Delivery Fee: ${order.deliveryFee}</span>
                </div>
              </div>
            );
          })
        )}

        <div className="flex justify-between mt-6">
          <Button
            variant="outline"
            disabled={!prevCursor}
            onClick={() => setCursor(prevCursor)}>
            Previous
          </Button>
          <Button
            variant="outline"
            disabled={!nextCursor}
            onClick={() => setCursor(nextCursor)}>
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
