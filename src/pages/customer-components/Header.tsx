import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import SearchResults from "./SearchResults";

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

interface SearchState {
  restaurants: Restaurant[];
  dishes: Dish[];
  cuisines: string[];
}

interface HeaderProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  currency: string;
  setCurrency: (value: string) => void;
  toggleNearbyView: () => void;
  showNearbyOnly: boolean;
  isGettingLocation: boolean;
  userLocation: { lat: number; lng: number } | null;
  onSelectRestaurant?: (restaurantId: string) => void;
  onSelectCuisine?: (cuisine: string) => void;
}

export default function Header({
  searchTerm,
  setSearchTerm,
  currency,
  setCurrency,
  toggleNearbyView,
  showNearbyOnly,
  isGettingLocation,
  userLocation,
  onSelectRestaurant,
  onSelectCuisine,
}: HeaderProps) {
  const [searchResults, setSearchResults] = useState<SearchState>({
    restaurants: [],
    dishes: [],
    cuisines: [],
  });
  const [showResults, setShowResults] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!searchTerm.trim()) {
      setSearchResults({ restaurants: [], dishes: [], cuisines: [] });
      setShowResults(false);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const params = new URLSearchParams({ q: searchTerm });
        if (userLocation) {
          params.append("lat", userLocation.lat.toString());
          params.append("lng", userLocation.lng.toString());
        }

        const response = await fetch(`/api/restaurants/search/?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data);
          setShowResults(true);
        }
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchTerm, userLocation]);

  const handleSelectRestaurant = (restaurantId: string) => {
    setShowResults(false);
    setSearchTerm("");
    onSelectRestaurant?.(restaurantId);
  };

  const handleSelectCuisine = (cuisine: string) => {
    setShowResults(false);
    setSearchTerm("");
    onSelectCuisine?.(cuisine);
  };

  return (
    <header className="relative overflow-hidden" style={{
      background: 'linear-gradient(135deg, #f97316 0%, #ea580c 50%, #c2410c 100%)',
    }}>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center">
          <div className="mb-6 lg:mb-0">
            <h1 className="text-4xl lg:text-5xl font-black text-white mb-2 tracking-tight">
              Delicious food, delivered fast
            </h1>
            <p className="text-xl text-white/90 font-medium">
              Order from your favorite restaurants in Zimbabwe
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-4 py-2 border border-white/20">
              <p className="text-xs text-white/80 font-medium mb-1">Currency</p>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="bg-transparent border-0 text-white font-bold p-0 h-auto shadow-none focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="ZWL">ZWL (Z$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="mt-8 max-w-3xl" ref={searchContainerRef}>
          <div className="relative">
            <div className="absolute -inset-1 bg-white/20 blur-xl rounded-3xl" />
            <div className="relative flex gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-0 bg-white/10 rounded-2xl" />
                <div className="relative bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 flex items-center">
                  <i className={`fas ${isSearching ? 'fa-spinner fa-spin' : 'fa-search'} ml-5 text-zinc-400`}></i>
                  <Input
                    type="text"
                    placeholder="Search restaurants, cuisines, or dishes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onFocus={() => searchTerm && setShowResults(true)}
                    className="flex-1 border-0 bg-transparent text-lg py-5 px-4 focus:ring-0 focus-visible:ring-0 placeholder:text-zinc-400"
                  />
                </div>
                
                <SearchResults
                  isVisible={showResults}
                  restaurants={searchResults.restaurants}
                  dishes={searchResults.dishes}
                  cuisines={searchResults.cuisines}
                  query={searchTerm}
                  onSelectRestaurant={handleSelectRestaurant}
                  onSelectCuisine={handleSelectCuisine}
                  onClose={() => setShowResults(false)}
                />
              </div>
              
              <Button
                onClick={toggleNearbyView}
                disabled={isGettingLocation}
                className={`px-6 py-5 h-auto rounded-2xl text-base font-bold whitespace-nowrap transition-all shadow-lg ${
                  showNearbyOnly
                    ? 'bg-white text-orange-600 hover:bg-zinc-100 shadow-xl'
                    : 'bg-white/20 text-white border-2 border-white/30 hover:bg-white/30 backdrop-blur-sm'
                }`}
              >
                {isGettingLocation ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>Getting...
                  </>
                ) : showNearbyOnly ? (
                  <>
                    <i className="fas fa-map-marker-alt mr-2"></i>Show All
                  </>
                ) : (
                  <>
                    <i className="fas fa-location-arrow mr-2"></i>Find Nearby
                  </>
                )}
              </Button>
            </div>
          </div>
          
          {showNearbyOnly && userLocation && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-2 text-sm text-white font-medium">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              Showing restaurants within 10km of your location
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
