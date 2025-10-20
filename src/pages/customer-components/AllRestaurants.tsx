import RestaurantCard from "@/components/RestaurantCard";
import { Restaurant } from "./types";

interface AllRestaurantsProps {
  restaurants: Restaurant[];
  currency: string;
  onViewMenu: (restaurant: Restaurant) => void;
  userLocation: { lat: number; lng: number } | null;
}

export default function AllRestaurants({ restaurants, currency, onViewMenu, userLocation }: AllRestaurantsProps) {
  if (!restaurants || restaurants.length === 0) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-search text-4xl text-muted-foreground mb-4"></i>
        <p className="text-muted-foreground">No restaurants found</p>
      </div>
    );
  }

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">All Restaurants</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Showing all {restaurants.length} restaurants
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {restaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              currency={currency}
              onViewMenu={onViewMenu}
              userLocation={userLocation}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
