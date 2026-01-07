import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DriverLocationMap from "./DriverLocationMap";
import { MapPin, Phone, Package, Clock, Truck, CheckCircle, ChefHat } from "lucide-react";
import { useOrderSocket } from "@/hooks/useOrderSocket";

interface OrderData {
  id: string;
  status: string;
  method: string;
  restaurant_names: string;
  driver_name?: string;
  driver_phone?: string;
  driver_vehicle?: string;
  created: string;
  delivery_address?: string;
}

interface OrderTrackingProps {
  order: OrderData | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  paid: { label: "Order Confirmed", icon: <CheckCircle className="w-4 h-4" />, color: "bg-green-500" },
  pending: { label: "Order Placed", icon: <Package className="w-4 h-4" />, color: "bg-gray-400" },
  preparing: { label: "Preparing", icon: <ChefHat className="w-4 h-4" />, color: "bg-yellow-500" },
  ready: { label: "Ready", icon: <CheckCircle className="w-4 h-4" />, color: "bg-blue-500" },
  finding_driver: { label: "Finding Driver", icon: <Truck className="w-4 h-4" />, color: "bg-orange-400" },
  assigned: { label: "Driver Assigned", icon: <Truck className="w-4 h-4" />, color: "bg-blue-500" },
  out_for_delivery: { label: "Out for Delivery", icon: <Truck className="w-4 h-4" />, color: "bg-blue-600" },
  delivered: { label: "Delivered", icon: <CheckCircle className="w-4 h-4" />, color: "bg-green-600" },
  collected: { label: "Collected", icon: <CheckCircle className="w-4 h-4" />, color: "bg-green-600" },
  cancelled: { label: "Cancelled", icon: <Package className="w-4 h-4" />, color: "bg-red-500" },
};

const DELIVERY_FLOW = ['paid', 'preparing', 'ready', 'assigned', 'out_for_delivery', 'delivered'];
const COLLECTION_FLOW = ['paid', 'preparing', 'ready', 'collected'];

export default function OrderTracking({ order, isOpen, onClose }: OrderTrackingProps) {
  const [isDriverMapOpen, setIsDriverMapOpen] = useState(false);
  
  const orderMethod = order?.method === 'delivery' ? 'delivery' : 'collection';
  
  const { 
    connected, 
    status: socketStatus, 
    driver: socketDriver, 
    driverLocation, 
    eta 
  } = useOrderSocket(order?.id || null, orderMethod);

  const currentStatus = socketStatus || order?.status || 'pending';
  const isDelivery = order?.method === 'delivery';
  const statusFlow = isDelivery ? DELIVERY_FLOW : COLLECTION_FLOW;
  
  const driverName = socketDriver?.name || order?.driver_name;
  const driverPhone = socketDriver?.phone || order?.driver_phone;
  const driverVehicle = socketDriver?.vehicle || order?.driver_vehicle;

  const getStatusIndex = (status: string) => {
    const normalizedStatus = status === 'finding_driver' ? 'assigned' : status;
    return statusFlow.indexOf(normalizedStatus);
  };

  const currentStatusIndex = getStatusIndex(currentStatus);

  if (!isOpen || !order) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="m-4 max-w-md w-full max-h-[90vh] overflow-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg" data-testid="text-track-order-title">
                Track Your Order
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {order.restaurant_names}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-close-tracking"
            >
              <span className="text-lg">&times;</span>
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={connected ? "default" : "secondary"}>
              {connected ? "Live" : "Connecting..."}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {isDelivery ? "Delivery" : "Collection"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {statusFlow.map((status, index) => {
              const config = STATUS_CONFIG[status] || { label: status, icon: <Package className="w-4 h-4" />, color: "bg-gray-400" };
              const isCompleted = index < currentStatusIndex;
              const isCurrent = index === currentStatusIndex;
              const isPending = index > currentStatusIndex;
              
              return (
                <div key={status} className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                    isCompleted ? 'bg-green-500 text-white' :
                    isCurrent ? `${config.color} text-white animate-pulse` :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {config.icon}
                  </div>
                  <div className="flex-1">
                    <p className={`font-medium ${isPending ? 'text-muted-foreground' : ''}`}>
                      {config.label}
                    </p>
                    {isCurrent && currentStatus === 'finding_driver' && (
                      <p className="text-sm text-orange-600">Looking for nearby driver...</p>
                    )}
                    {isCurrent && eta && (
                      <p className="text-sm text-muted-foreground">
                        <Clock className="w-3 h-3 inline mr-1" />
                        ETA: {eta} minutes
                      </p>
                    )}
                  </div>
                  {isCompleted && (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  )}
                </div>
              );
            })}
          </div>
          
          {isDelivery && driverName && ['assigned', 'out_for_delivery'].includes(currentStatus) && (
            <Card className="mt-6 p-4 bg-muted">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Truck className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">{driverName}</p>
                  {driverVehicle && (
                    <p className="text-sm text-muted-foreground">{driverVehicle}</p>
                  )}
                  {eta && (
                    <p className="text-sm text-blue-600 mt-1">
                      <Clock className="w-3 h-3 inline mr-1" />
                      Arriving in ~{eta} min
                    </p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                {driverPhone && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(`tel:${driverPhone}`)}
                    data-testid="button-call-driver"
                  >
                    <Phone className="w-4 h-4 mr-1" />
                    Call
                  </Button>
                )}
                {currentStatus === "out_for_delivery" && (
                  <Button 
                    variant="default" 
                    size="sm"
                    className="flex-1"
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

          {!isDelivery && currentStatus === 'ready' && (
            <Card className="mt-6 p-4 bg-green-50 dark:bg-green-950/30 border-green-200">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Ready for Collection!
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    Your order is waiting at {order.restaurant_names}
                  </p>
                </div>
              </div>
            </Card>
          )}
        </CardContent>
      </Card>

      <DriverLocationMap
        orderId={order.id}
        isOpen={isDriverMapOpen}
        onClose={() => setIsDriverMapOpen(false)}
      />
    </div>
  );
}

export function OrderTrackingButton({ order, onClick }: { order: OrderData | null; onClick: () => void }) {
  const { status: socketStatus } = useOrderSocket(order?.id || null);
  const currentStatus = socketStatus || order?.status;
  
  const isActiveOrder = currentStatus && !['delivered', 'collected', 'cancelled'].includes(currentStatus);
  
  if (!order || !isActiveOrder) {
    return null;
  }

  const config = STATUS_CONFIG[currentStatus] || { label: currentStatus, color: "bg-gray-400" };

  return (
    <Button
      onClick={onClick}
      className="fixed bottom-20 right-6 bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg"
      data-testid="button-track-order"
    >
      <MapPin className="w-4 h-4 mr-2" />
      {config.label}
    </Button>
  );
}
