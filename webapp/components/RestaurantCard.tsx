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
  
  const getDeliveryRateDisplay = (): string => {
    return `${getCurrencySymbol(currency)}${DELIVERY_RATE_PER_KM.toFixed(2)}/km`;
  };

  return (
    <Card className="group overflow-hidden bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-zinc-200 dark:border-white/10 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer rounded-3xl hover:-translate-y-1">
      <div className="relative w-full h-48 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        {restaurant.imageUrl ? (
          <img 
            src={restaurant.imageUrl} 
            alt={restaurant.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <i className="fas fa-utensils text-4xl text-zinc-300 dark:text-zinc-600"></i>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        
        <div className="absolute top-3 right-3 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-sm px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-lg">
          <span className="text-orange-500">★</span>
          {restaurant.rating || '4.5'}
        </div>
        
        <div className="absolute bottom-3 left-3 right-3 flex justify-end items-center opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
          <span className="text-[10px] font-black bg-orange-500 text-white px-3 py-1 rounded-full uppercase tracking-tight">
            {restaurant.est_delivery_time || '30-40 mins'}
          </span>
        </div>
      </div>
      
      <CardContent className="p-5">
        <h3 className="font-bold text-lg group-hover:text-orange-500 transition-colors truncate" data-testid={`text-restaurant-name-${restaurant.id}`}>
          {restaurant.name}
        </h3>
        <p className="text-zinc-500 dark:text-white/50 text-sm mt-1 line-clamp-1" data-testid={`text-cuisine-${restaurant.id}`}>
          {restaurant.cuisines && restaurant.cuisines.length > 0 
            ? restaurant.cuisines.map(c => c.name).join(', ') 
            : 'Restaurant'} • {restaurant.description || 'Great food'}
        </p>
        
        <div className="flex items-center justify-between mt-3 text-sm">
          <span className="text-zinc-400 dark:text-white/40">
            {restaurant.est_delivery_time || '30-40 mins'}
          </span>
          <span className="font-medium text-orange-600 dark:text-orange-400" data-testid={`text-delivery-fee-${restaurant.id}`}>
            {getDeliveryRateDisplay()}
          </span>
        </div>
        
        <Button 
          className="w-full mt-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30 transition-all"
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
