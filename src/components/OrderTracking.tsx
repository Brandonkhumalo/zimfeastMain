import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DriverLocationMap from "./DriverLocationMap";
import { MapPin } from "lucide-react";

export default function OrderTracking() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDriverMapOpen, setIsDriverMapOpen] = useState(false);

  // Mock order data
  const order = {
    id: "order-142",
    status: "out_for_delivery", // Changed to show driver tracking
    items: ["2x Sadza with Beef Stew", "1x Mazanje"],
    driver: {
      name: "John Mukamuri",
      vehicle: "Toyota Vitz • ABC 123 GP",
      phone: "+263 77 123 4567"
    },
    timeline: [
      { status: "confirmed", time: "2:30 PM", completed: true },
      { status: "preparing", time: "2:35 PM", completed: true },
      { status: "out_for_delivery", time: "3:15 PM", completed: true },
      { status: "delivered", time: "Estimated 3:30 PM", completed: false }
    ]
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "confirmed": return "Order Confirmed";
      case "preparing": return "Restaurant Preparing";
      case "out_for_delivery": return "Out for Delivery";
      case "delivered": return "Delivered";
      default: return status;
    }
  };

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-20 right-6 bg-secondary text-secondary-foreground hover:bg-secondary/90"
        data-testid="button-track-order"
      >
        <i className="fas fa-map-marker-alt mr-2"></i>
        Track Order
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="m-4 max-w-md w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle data-testid="text-track-order-title">Track Your Order</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(false)}
              data-testid="button-close-tracking"
            >
              <i className="fas fa-times"></i>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {order.timeline.map((step, index) => (
              <div key={step.status} className="flex items-center space-x-3">
                <div className={`w-4 h-4 rounded-full ${
                  step.completed ? 'bg-primary' : 'bg-muted'
                }`}></div>
                <div className="flex-1">
                  <p className={`font-medium ${step.completed ? '' : 'text-muted-foreground'}`}>
                    {getStatusLabel(step.status)}
                  </p>
                  <p className="text-sm text-muted-foreground">{step.time}</p>
                </div>
              </div>
            ))}
          </div>
          
          {(order.status === "preparing" || order.status === "out_for_delivery") && (
            <Card className="mt-6 p-4 bg-muted">
              <p className="text-sm font-medium mb-2">Driver: {order.driver.name}</p>
              <p className="text-sm text-muted-foreground mb-2">{order.driver.vehicle}</p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  data-testid="button-call-driver"
                >
                  <i className="fas fa-phone mr-1"></i>Call Driver
                </Button>
                {order.status === "out_for_delivery" && (
                  <Button 
                    variant="default" 
                    size="sm"
                    onClick={() => setIsDriverMapOpen(true)}
                    data-testid="button-track-driver"
                  >
                    <MapPin className="w-4 h-4 mr-1" />
                    Track Driver
                  </Button>
                )}
              </div>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Driver Location Map */}
      <DriverLocationMap
        orderId={order.id}
        isOpen={isDriverMapOpen}
        onClose={() => setIsDriverMapOpen(false)}
      />
    </div>
  );
}
