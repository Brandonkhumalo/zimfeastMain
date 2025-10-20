import RestaurantCard from "@/components/RestaurantCard";
import { Restaurant } from "./types";

interface RestaurantGridProps {
  restaurants: Restaurant[];
  currency: string;
  addToCart: (item: any) => void;
  userLocation: { lat: number; lng: number } | null;
}

export default function RestaurantGrid({ restaurants, currency, addToCart, userLocation }: RestaurantGridProps) {
  if (!restaurants || restaurants.length === 0) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-search text-4xl text-muted-foreground mb-4"></i>
        <p className="text-muted-foreground">No restaurants found</p>
      </div>
    );
  }

  // Split into two rows: top 5 and bottom 5
  const topRow = restaurants.slice(0, 5);
  const bottomRow = restaurants.slice(5, 10);

  const renderRow = (row: typeof topRow) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-6">
      {row.map((r) => (
        <RestaurantCard key={r.id} restaurant={r} currency={currency} onAddToCart={addToCart} userLocation={userLocation} />
      ))}
    </div>
  );

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold mb-6">Restaurants near you</h2>
        {renderRow(topRow)}
        {renderRow(bottomRow)}
      </div>
    </section>
  );
}
