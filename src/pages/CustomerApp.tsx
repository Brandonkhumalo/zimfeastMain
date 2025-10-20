import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import OrderTracking from "@/components/OrderTracking";
import { Button } from "@/components/ui/button";

import Header from "./customer-components/Header";
import QuickFilters from "./customer-components/QuickFilters";
import RestaurantGrid from "./customer-components/RestaurantGrid";
import CartComponent from "./customer-components/CartComponent";
import TopRestaurant from "./customer-components/TopRestaurants";
import AllRestaurants from "./customer-components/AllRestaurants";
import MenuDialog from "@/components/MenuDialog";
import { Restaurant, CartItem } from "./customer-components/types";

export default function CustomerApp() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showNearbyOnly, setShowNearbyOnly] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);
  const [restaurantsData, setRestaurantsData] = useState<Restaurant[]>([]);
  const [allRestaurantsData, setAllRestaurantsData] = useState<Restaurant[]>([]);
  
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);

  // Pagination states
  const [gridPage, setGridPage] = useState(0);
  const [topPage, setTopPage] = useState(0);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => (window.location.href = "/login"), 500);
      return;
    }
  }, [isAuthenticated, isLoading, toast]);

  const fetchRestaurants = async (cursorUrl?: string) => {
    try {
      let url: string;
      
      if (cursorUrl) {
        url = cursorUrl;
      } else {
        const params = new URLSearchParams();
        if (userLocation) {
          params.append("lat", userLocation.lat.toString());
          params.append("lng", userLocation.lng.toString());
        }
        if (selectedCuisine) params.append("cuisine", selectedCuisine);
        
        url = `/api/restaurants/nearby/${params.toString() ? '?' + params.toString() : ''}`;
      }

      const token = localStorage.getItem("token");
      const res = await fetch(url, {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) throw new Error("Failed to fetch restaurants");
      const data = await res.json();
      setRestaurantsData(data.results || data);
      setNextCursor(data.next || null);
      setPrevCursor(data.previous || null);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to fetch restaurants", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchRestaurants();
  }, [userLocation, showNearbyOnly, selectedCuisine]);

  // Fetch all restaurants (unfiltered) for the "All Restaurants" section
  const fetchAllRestaurants = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch('/api/restaurants/nearby/?page_size=100', {
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) throw new Error("Failed to fetch all restaurants");
      const data = await res.json();
      setAllRestaurantsData(data.results || data);
    } catch (err: any) {
      console.error("Error fetching all restaurants:", err);
    }
  };

  useEffect(() => {
    fetchAllRestaurants();
  }, []);

  const loadNext = () => {
    if (!nextCursor) return;
    fetchRestaurants(nextCursor);
  };

  const loadPrev = () => {
    if (!prevCursor) return;
    fetchRestaurants(prevCursor);
  };

  const toggleNearbyView = () => {
    if (!showNearbyOnly) {
      if (userLocation) setShowNearbyOnly(true);
      else getCurrentLocation();
    } else {
      setShowNearbyOnly(false);
    }
  };

  const getCurrentLocation = () => {
    setIsGettingLocation(true);
    if (!navigator.geolocation) {
      toast({ title: "Location Not Supported", description: "Your browser doesn't support geolocation", variant: "destructive" });
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setShowNearbyOnly(true);
        setIsGettingLocation(false);
        toast({ title: "Location Found", description: "Showing nearby restaurants within 10km", variant: "default" });
      },
      () => {
        setIsGettingLocation(false);
        toast({ title: "Location Access Denied", description: "Enable location services to find nearby restaurants", variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    );
  };

  const addToCart = (item: CartItem) => {
    setCartItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { ...item, quantity: 1 }];
    });
    toast({
      title: "Added to cart",
      description: `${item.name} added to your cart`,
      variant: "default",
    });
  };

  const handleViewMenu = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setIsMenuDialogOpen(true);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // Pagination slices
  const gridRestaurants = restaurantsData.slice(gridPage * 5, gridPage * 5 + 5);
  const topRestaurants = restaurantsData
    .filter(r => r.rating && r.rating >= 4) // filter by rating
    .slice(topPage * 5, topPage * 5 + 5);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Header
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        currency={currency}
        setCurrency={setCurrency}
        toggleNearbyView={toggleNearbyView}
        showNearbyOnly={showNearbyOnly}
        isGettingLocation={isGettingLocation}
        userLocation={userLocation}
      />
      <QuickFilters selectedCuisine={selectedCuisine} setSelectedCuisine={setSelectedCuisine} />

      {/* Restaurants Grid */}
      <RestaurantGrid
        restaurants={gridRestaurants}
        currency={currency}
        onViewMenu={handleViewMenu}
        userLocation={userLocation}
      />
      <div className="flex justify-center gap-4 py-4">
        <Button onClick={() => setGridPage(p => Math.max(p - 1, 0))} disabled={gridPage === 0}>Previous 5</Button>
        <Button onClick={() => setGridPage(p => (p + 1) * 5 < restaurantsData.length ? p + 1 : p)} disabled={(gridPage + 1) * 5 >= restaurantsData.length}>Next 5</Button>
      </div>

      {/* Top Restaurants */}
      <TopRestaurant
        restaurants={topRestaurants}
        currency={currency}
        onViewMenu={handleViewMenu}
        userLocation={userLocation}
      />
      <div className="flex justify-center gap-4 py-4">
        <Button onClick={() => setTopPage(p => Math.max(p - 1, 0))} disabled={topPage === 0}>Previous Top 5</Button>
        <Button onClick={() => setTopPage(p => (p + 1) * 5 < restaurantsData.filter(r => r.rating && r.rating >= 4).length ? p + 1 : p)} disabled={(topPage + 1) * 5 >= restaurantsData.filter(r => r.rating && r.rating >= 4).length}>Next Top 5</Button>
      </div>

      {/* All Restaurants */}
      <AllRestaurants
        restaurants={allRestaurantsData}
        currency={currency}
        onViewMenu={handleViewMenu}
        userLocation={userLocation}
      />

      <MenuDialog
        restaurant={selectedRestaurant}
        isOpen={isMenuDialogOpen}
        onClose={() => {
          setIsMenuDialogOpen(false);
          setSelectedRestaurant(null);
        }}
        onAddToCart={addToCart}
        currency={currency}
      />

      <CartComponent
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        items={cartItems}
        setItems={setCartItems}
        currency={currency}
        userLocation={userLocation}
      />

      <OrderTracking />

      <Button
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg hover:shadow-xl transition-shadow">
        <i className="fas fa-shopping-cart text-xl"></i>
        {cartItems.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-xs w-6 h-6 rounded-full flex items-center justify-center">
            {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
          </span>
        )}
      </Button>
    </div>
  );
}
