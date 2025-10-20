import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Restaurant } from "@shared/schema";
import { calculateDeliveryFeeFromCoordinates, DEFAULT_DELIVERY_FEE } from "@shared/deliveryUtils";

interface RestaurantCardProps {
  restaurant: Restaurant;
  currency: string;
  onAddToCart: (item: any) => void;
  userLocation?: {lat: number, lng: number} | null;
}

export default function RestaurantCard({ restaurant, currency, onAddToCart, userLocation }: RestaurantCardProps) {
  const getCurrencySymbol = (curr: string) => curr === 'USD' ? '$' : 'Z$';
  
  // Calculate delivery fee based on distance
  const getDeliveryFee = (): string => {
    if (!userLocation || !restaurant.coordinates) {
      return DEFAULT_DELIVERY_FEE.toFixed(2); // Default delivery fee when location not available
    }
    
    const coords = restaurant.coordinates as {lat: number, lng: number};
    if (!coords.lat || !coords.lng) {
      return DEFAULT_DELIVERY_FEE.toFixed(2); // Default when restaurant coordinates invalid
    }
    
    const fee = calculateDeliveryFeeFromCoordinates(
      userLocation.lat,
      userLocation.lng,
      coords.lat,
      coords.lng
    );
    
    return fee.toFixed(2);
  };
  
  const handleViewMenu = () => {
    // In a real app, this would navigate to restaurant menu page
    // For now, we'll simulate adding a sample item to cart
    const coords = restaurant.coordinates as {lat: number, lng: number} | undefined;
    onAddToCart({
      id: `${restaurant.id}-sample`,
      name: "Sample Dish",
      price: parseFloat(getDeliveryFee()),
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantLat: coords?.lat,
      restaurantLng: coords?.lng
    });
  };

  return (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer">
      <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
        {restaurant.imageUrl ? (
          <img 
            src={restaurant.imageUrl} 
            alt={restaurant.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <i className="fas fa-utensils text-4xl text-gray-400"></i>
        )}
      </div>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-lg" data-testid={`text-restaurant-name-${restaurant.id}`}>
            {restaurant.name}
          </h3>
          <Badge className="bg-primary text-primary-foreground">
            <i className="fas fa-star mr-1"></i>
            {restaurant.rating || '4.5'}
          </Badge>
        </div>
        <p className="text-muted-foreground text-sm mb-2" data-testid={`text-cuisine-${restaurant.id}`}>
          {restaurant.cuisineType.charAt(0).toUpperCase() + restaurant.cuisineType.slice(1).replace('_', ' ')} • {restaurant.description || 'Great food'}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {restaurant.estimatedDeliveryTime || 30}-{(restaurant.estimatedDeliveryTime || 30) + 10} min
          </span>
          <span className="text-sm font-medium" data-testid={`text-delivery-fee-${restaurant.id}`}>
            {getCurrencySymbol(currency)}{getDeliveryFee()} delivery
          </span>
        </div>
        <Button 
          className="w-full mt-3"
          onClick={handleViewMenu}
          data-testid={`button-view-menu-${restaurant.id}`}
        >
          View Menu
        </Button>
      </CardContent>
    </Card>
  );
}
