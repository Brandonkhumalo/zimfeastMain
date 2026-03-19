import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function AssignedOrderCard({ order }: { order: any }) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle>Order Assigned: #{order.id.slice(-6)}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Customer: {order.customerName}</p>
          <p>Delivery Fee: ${order.deliveryFee}</p>
          <p>Address: {order.deliveryAddress}</p>
          <div className="flex gap-2 mt-2">
            <Button size="sm">Decline</Button>
            <Button size="sm">Accept</Button>
            <Button size="sm">Call</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
