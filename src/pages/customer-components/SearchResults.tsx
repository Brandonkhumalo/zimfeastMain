import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Restaurant {
  id: string;
  name: string;
  description: string;
  cuisines: string[];
  profile_image: string | null;
  est_delivery_time: string;
  minimum_order_price: number;
}

interface Dish {
  id: string;
  name: string;
  description: string;
  price: number;
  categories: string[];
  restaurant_id: string;
  restaurant_name: string;
  image_url: string | null;
}

interface SearchResultsProps {
  isVisible: boolean;
  restaurants: Restaurant[];
  dishes: Dish[];
  cuisines: string[];
  query: string;
  onSelectRestaurant: (restaurantId: string) => void;
  onSelectCuisine: (cuisine: string) => void;
  onClose: () => void;
}

export default function SearchResults({
  isVisible,
  restaurants,
  dishes,
  cuisines,
  query,
  onSelectRestaurant,
  onSelectCuisine,
  onClose,
}: SearchResultsProps) {
  if (!isVisible || !query) return null;

  const hasResults = restaurants.length > 0 || dishes.length > 0 || cuisines.length > 0;

  return (
    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border z-50 max-h-[70vh] overflow-hidden">
      <ScrollArea className="max-h-[70vh]">
        <div className="p-4">
          {!hasResults ? (
            <div className="text-center py-8 text-gray-500">
              <span className="text-4xl mb-4 block">🔍</span>
              <p>No results found for "{query}"</p>
              <p className="text-sm mt-2">Try searching for a restaurant name, cuisine, or dish</p>
            </div>
          ) : (
            <>
              {cuisines.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-500 mb-2">Cuisines</h4>
                  <div className="flex flex-wrap gap-2">
                    {cuisines.map((cuisine) => (
                      <Badge
                        key={cuisine}
                        variant="secondary"
                        className="cursor-pointer hover:bg-primary hover:text-white"
                        onClick={() => {
                          onSelectCuisine(cuisine);
                          onClose();
                        }}
                      >
                        {cuisine}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {restaurants.length > 0 && (
                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-500 mb-2">Restaurants</h4>
                  <div className="space-y-2">
                    {restaurants.slice(0, 5).map((restaurant) => (
                      <Card
                        key={restaurant.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          onSelectRestaurant(restaurant.id);
                          onClose();
                        }}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          {restaurant.profile_image ? (
                            <img
                              src={restaurant.profile_image}
                              alt={restaurant.name}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                              <span className="text-xl">🍽️</span>
                            </div>
                          )}
                          <div className="flex-1">
                            <h5 className="font-semibold">{restaurant.name}</h5>
                            <p className="text-sm text-muted-foreground line-clamp-1">
                              {restaurant.cuisines.join(", ") || restaurant.description}
                            </p>
                          </div>
                          <div className="text-right text-sm">
                            <p className="text-muted-foreground">{restaurant.est_delivery_time}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {dishes.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 mb-2">Dishes</h4>
                  <div className="space-y-2">
                    {dishes.slice(0, 5).map((dish) => (
                      <Card
                        key={dish.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          onSelectRestaurant(dish.restaurant_id);
                          onClose();
                        }}
                      >
                        <CardContent className="p-3 flex items-center gap-3">
                          {dish.image_url ? (
                            <img
                              src={dish.image_url}
                              alt={dish.name}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                              <span className="text-xl">🍴</span>
                            </div>
                          )}
                          <div className="flex-1">
                            <h5 className="font-semibold">{dish.name}</h5>
                            <p className="text-sm text-muted-foreground">
                              at {dish.restaurant_name}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-primary">${dish.price.toFixed(2)}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <div className="mt-4 pt-4 border-t">
            <Button variant="ghost" className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
