import RestaurantCard from "@/components/RestaurantCard";
import { Restaurant } from "./types";

interface RestaurantGridProps {
  restaurants: Restaurant[];
  currency: string;
  onViewMenu: (restaurant: Restaurant) => void;
  userLocation: { lat: number; lng: number } | null;
}

export default function RestaurantGrid({ restaurants, currency, onViewMenu, userLocation }: RestaurantGridProps) {
  if (!restaurants || restaurants.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto mb-4 bg-zinc-100 dark:bg-white/10 rounded-full flex items-center justify-center">
          <i className="fas fa-search text-3xl text-zinc-400 dark:text-white/40"></i>
        </div>
        <p className="text-zinc-500 dark:text-white/50 font-medium">No restaurants found</p>
      </div>
    );
  }

  const topRow = restaurants.slice(0, 5);
  const bottomRow = restaurants.slice(5, 10);

  const renderRow = (row: typeof topRow) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-6">
      {row.map((r) => (
        <RestaurantCard key={r.id} restaurant={r} currency={currency} onViewMenu={onViewMenu} userLocation={userLocation} />
      ))}
    </div>
  );

  return (
    <section className="py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20">
            <i className="fas fa-map-marker-alt text-white"></i>
          </div>
          <h2 className="text-2xl font-black tracking-tight">Restaurants near you</h2>
        </div>
        {renderRow(topRow)}
        {renderRow(bottomRow)}
      </div>
    </section>
  );
}
