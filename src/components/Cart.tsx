import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Restaurant } from "@shared/schema";
import { calculateDeliveryFeeFromCoordinates, DEFAULT_DELIVERY_FEE } from "@shared/deliveryUtils";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  restaurantId?: string;
  restaurantName?: string;
}

interface CartProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  currency: string;
  userLocation?: {lat: number, lng: number} | null;
}

export default function Cart({ isOpen, onClose, items, onUpdateQuantity, currency, userLocation }: CartProps) {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const getCurrencySymbol = (curr: string) => curr === 'USD' ? '$' : 'Z$';
  
  // Get unique restaurant IDs from cart items
  const restaurantIds = Array.from(new Set(items.map(item => item.restaurantId).filter(Boolean) as string[]));
  
  // Fetch restaurant data for delivery fee calculation
  const { data: restaurants } = useQuery<Restaurant[]>({
    queryKey: ['/api/restaurants'],
    enabled: restaurantIds.length > 0,
  });
  
  // Calculate delivery fee based on distance to restaurants
  const getDeliveryFee = (): number => {
    if (!userLocation || !restaurants || restaurants.length === 0) {
      return DEFAULT_DELIVERY_FEE; // Default delivery fee when location not available
    }
    
    let maxDeliveryFee = 1.50; // Minimum delivery fee
    
    // For each restaurant in the cart, calculate delivery fee and use the highest one
    restaurantIds.forEach(restaurantId => {
      const restaurant = restaurants.find(r => r.id === restaurantId);
      if (restaurant && restaurant.coordinates) {
        const coords = restaurant.coordinates as {lat: number, lng: number};
        if (coords.lat && coords.lng) {
          const fee = calculateDeliveryFeeFromCoordinates(
            userLocation.lat,
            userLocation.lng,
            coords.lat,
            coords.lng
          );
          maxDeliveryFee = Math.max(maxDeliveryFee, fee);
        }
      }
    });
    
    return maxDeliveryFee;
  };
  
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const deliveryFee = getDeliveryFee();
  const total = subtotal + deliveryFee;

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!userLocation) {
        throw new Error('Location is required for delivery');
      }

      // For multiple restaurants, we'll create separate orders for each restaurant
      // For now, let's handle single restaurant orders (most common case)
      const firstRestaurantId = restaurantIds[0];
      if (!firstRestaurantId) {
        throw new Error('No restaurant selected');
      }

      const restaurantItems = items.filter(item => item.restaurantId === firstRestaurantId);
      
      const orderData = {
        restaurantId: firstRestaurantId,
        items: restaurantItems.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal: restaurantItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toString(),
        deliveryCoordinates: userLocation, // Backend will use this to calculate delivery fee
        deliveryAddress: 'Current Location', // Could be improved with actual address
        currency,
        status: 'pending' as const,
      };

      const response = await apiRequest('POST', '/api/orders', orderData);
      return response.json();
    },
    onSuccess: (order: any) => {
      toast({
        title: "Order Created",
        description: "Redirecting to payment...",
      });
      
      // Invalidate orders cache
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      
      // Redirect to checkout with order ID
      setLocation(`/checkout?orderId=${order.id}`);
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Unable to create order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleCheckout = () => {
    if (items.length === 0) return;
    
    if (!userLocation) {
      toast({
        title: "Location Required",
        description: "Please enable location access to calculate delivery fee.",
        variant: "destructive",
      });
      return;
    }

    if (restaurantIds.length > 1) {
      toast({
        title: "Multiple Restaurants",
        description: "Please order from one restaurant at a time.",
        variant: "destructive",
      });
      return;
    }

    createOrderMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black/50"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="ml-auto w-96 bg-white shadow-xl border-l border-border h-full flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-xl font-semibold" data-testid="text-cart-title">Your Cart</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            data-testid="button-close-cart"
          >
            <i className="fas fa-times text-xl"></i>
          </Button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {items.length === 0 ? (
            <div className="text-center py-12">
              <i className="fas fa-shopping-cart text-4xl text-muted-foreground mb-4"></i>
              <p className="text-muted-foreground" data-testid="text-empty-cart">Your cart is empty</p>
              <p className="text-sm text-muted-foreground mt-2">Add items from a restaurant to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium" data-testid={`text-item-name-${item.id}`}>
                        {item.name}
                      </h4>
                      {item.restaurantName && (
                        <p className="text-sm text-muted-foreground">
                          {item.restaurantName}
                        </p>
                      )}
                      <p className="text-sm font-medium mt-1" data-testid={`text-item-price-${item.id}`}>
                        {getCurrencySymbol(currency)}{item.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                        data-testid={`button-decrease-${item.id}`}
                      >
                        -
                      </Button>
                      <span className="px-2" data-testid={`text-quantity-${item.id}`}>
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        data-testid={`button-increase-${item.id}`}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
        
        {items.length > 0 && (
          <div className="border-t border-border p-6">
            <div className="space-y-2 mb-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span data-testid="text-subtotal">
                  {getCurrencySymbol(currency)}{subtotal.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                <span data-testid="text-delivery-fee">
                  {getCurrencySymbol(currency)}{deliveryFee.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total</span>
                <span data-testid="text-total">
                  {getCurrencySymbol(currency)}{total.toFixed(2)}
                </span>
              </div>
            </div>
            <Button 
              className="w-full" 
              onClick={handleCheckout}
              disabled={createOrderMutation.isPending}
              data-testid="button-checkout"
            >
              {createOrderMutation.isPending 
                ? 'Creating Order...' 
                : `Proceed to Checkout (${getCurrencySymbol(currency)}${total.toFixed(2)})`
              }
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
