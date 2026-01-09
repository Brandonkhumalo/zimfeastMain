import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Restaurant } from "@/pages/customer-components/types";
import { DELIVERY_RATE_PER_KM } from "@shared/deliveryUtils";

interface RestaurantCardProps {
  restaurant: Restaurant;
  currency: string;
  onViewMenu: (restaurant: Restaurant) => void;
  userLocation?: {lat: number, lng: number} | null;
}

export default function RestaurantCard({ restaurant, currency, onViewMenu, userLocation }: RestaurantCardProps) {
  const getCurrencySymbol = (curr: string) => curr === 'USD' ? '$' : 'Z$';
  
  // Show delivery rate per km instead of calculated fee
  const getDeliveryRateDisplay = (): string => {
    return `${getCurrencySymbol(currency)}${DELIVERY_RATE_PER_KM.toFixed(2)}/km`;
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
          {restaurant.cuisines && restaurant.cuisines.length > 0 
            ? restaurant.cuisines.map(c => c.name).join(', ') 
            : 'Restaurant'} • {restaurant.description || 'Great food'}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {restaurant.est_delivery_time || '30-40 mins'}
          </span>
          <span className="text-sm font-medium" data-testid={`text-delivery-fee-${restaurant.id}`}>
            Delivery {getDeliveryRateDisplay()}
          </span>
        </div>
        <Button 
          className="w-full mt-3"
          onClick={() => onViewMenu(restaurant)}
          data-testid={`button-view-menu-${restaurant.id}`}
        >
          <i className="fas fa-utensils mr-2"></i>
          View Menu ({restaurant.menu_items?.length || 0} items)
        </Button>
      </CardContent>
    </Card>
  );
}
