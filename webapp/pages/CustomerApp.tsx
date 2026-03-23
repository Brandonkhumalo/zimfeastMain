import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/hooks/useCart";
import { useRestaurants } from "@/hooks/useRestaurants";
import { useActiveOrder } from "@/hooks/useActiveOrder";
import { useUserLocation } from "@/hooks/useUserLocation";
import Navbar from "@/components/Navbar";
import OrderTracking, { OrderTrackingButton } from "@/components/OrderTracking";
import RatingDialog from "@/components/RatingDialog";
import { Button } from "@/components/ui/button";

import Header from "./customer-components/Header";
import QuickFilters from "./customer-components/QuickFilters";
import RestaurantGrid from "./customer-components/RestaurantGrid";
import CartComponent from "./customer-components/CartComponent";
import TopRestaurant from "./customer-components/TopRestaurants";
import AllRestaurants from "./customer-components/AllRestaurants";
import MenuDialog from "@/components/MenuDialog";
import ChefZimCard from "./customer-components/ChefZimCard";
import ChefZimDialog from "./customer-components/ChefZimDialog";
import ChefZimResults from "./customer-components/ChefZimResults";
import ReferralCard from "@/components/ReferralCard";
import BannerCarousel from "./customer-components/BannerCarousel";
import { Restaurant } from "./customer-components/types";

export default function CustomerApp() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();

  // Local UI states
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [isMenuDialogOpen, setIsMenuDialogOpen] = useState(false);

  // Chef Zim AI states
  const [isChefZimOpen, setIsChefZimOpen] = useState(false);
  const [isChefZimResultsOpen, setIsChefZimResultsOpen] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<{
    greeting: string;
    recommendations: any[];
    closing: string;
  }>({ greeting: "", recommendations: [], closing: "" });

  // Custom hooks
  const { cartItems, setCartItems, isCartOpen, setIsCartOpen, addToCart } = useCart();
  const { userLocation, setUserLocation, showNearbyOnly, setShowNearbyOnly, isGettingLocation, getCurrentLocation, toggleNearbyView } = useUserLocation();
  const { restaurantsData, allRestaurantsData, nextCursor, prevCursor, gridPage, setGridPage, topPage, setTopPage, loadNext, loadPrev } = useRestaurants({
    searchTerm,
    selectedCuisine,
    userLocation,
    showNearbyOnly,
    currency,
  });
  const { activeOrder, isTrackingOpen, setIsTrackingOpen, deliveredOrder, clearDeliveredOrder } = useActiveOrder({ isAuthenticated });

  // Auth check
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

  const handleViewMenu = (restaurant: Restaurant) => {
    setSelectedRestaurant(restaurant);
    setIsMenuDialogOpen(true);
  };

  const handleSelectRestaurantFromSearch = async (restaurantId: string) => {
    const restaurant = [...restaurantsData, ...allRestaurantsData].find(
      (r) => r.id === restaurantId
    );
    if (restaurant) {
      setSelectedRestaurant(restaurant);
      setIsMenuDialogOpen(true);
    } else {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`/api/restaurants/${restaurantId}/detail/`, {
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (res.ok) {
          const restaurantData = await res.json();
          setSelectedRestaurant(restaurantData);
          setIsMenuDialogOpen(true);
        }
      } catch (error) {
        console.error("Failed to fetch restaurant:", error);
      }
    }
  };

  const handleAiRecommendations = (data: any) => {
    setAiRecommendations({
      greeting: data.greeting || "",
      recommendations: data.recommendations || [],
      closing: data.closing || "",
    });
    setIsChefZimResultsOpen(true);
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  // Pagination slices
  const gridRestaurants = restaurantsData.slice(gridPage * 5, gridPage * 5 + 5);
  const topRestaurants = restaurantsData
    .filter(r => r.rating && r.rating >= 4)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
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
        onSelectRestaurant={handleSelectRestaurantFromSearch}
        onSelectCuisine={setSelectedCuisine}
      />

      <ChefZimCard onOpenDialog={() => setIsChefZimOpen(true)} />

      {/* Referral Card */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <ReferralCard />
      </div>

      <QuickFilters selectedCuisine={selectedCuisine} setSelectedCuisine={setSelectedCuisine} />

      {/* Promotional Banners */}
      <BannerCarousel />

      {/* Restaurants Grid */}
      <RestaurantGrid
        restaurants={gridRestaurants}
        currency={currency}
        onViewMenu={handleViewMenu}
        userLocation={userLocation}
      />
      <div className="flex justify-center gap-4 py-6">
        <Button
          onClick={() => setGridPage(p => Math.max(p - 1, 0))}
          disabled={gridPage === 0}
          className="rounded-xl font-bold px-6 disabled:opacity-40"
          variant="outline"
        >
          <i className="fas fa-chevron-left mr-2"></i>Previous
        </Button>
        <Button
          onClick={() => setGridPage(p => (p + 1) * 5 < restaurantsData.length ? p + 1 : p)}
          disabled={(gridPage + 1) * 5 >= restaurantsData.length}
          className="rounded-xl font-bold px-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 disabled:opacity-40"
        >
          Next<i className="fas fa-chevron-right ml-2"></i>
        </Button>
      </div>

      {/* Top Restaurants */}
      <TopRestaurant
        restaurants={topRestaurants}
        currency={currency}
        onViewMenu={handleViewMenu}
        userLocation={userLocation}
      />
      <div className="flex justify-center gap-4 py-6 bg-zinc-50/50 dark:bg-white/5">
        <Button
          onClick={() => setTopPage(p => Math.max(p - 1, 0))}
          disabled={topPage === 0}
          className="rounded-xl font-bold px-6 disabled:opacity-40"
          variant="outline"
        >
          <i className="fas fa-chevron-left mr-2"></i>Previous
        </Button>
        <Button
          onClick={() => setTopPage(p => (p + 1) * 5 < restaurantsData.filter(r => r.rating && r.rating >= 4).length ? p + 1 : p)}
          disabled={(topPage + 1) * 5 >= restaurantsData.filter(r => r.rating && r.rating >= 4).length}
          className="rounded-xl font-bold px-6 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-lg shadow-orange-500/20 disabled:opacity-40"
        >
          Next<i className="fas fa-chevron-right ml-2"></i>
        </Button>
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

      <OrderTracking
        order={activeOrder}
        isOpen={isTrackingOpen}
        onClose={() => setIsTrackingOpen(false)}
      />

      <OrderTrackingButton
        order={activeOrder}
        onClick={() => setIsTrackingOpen(true)}
      />

      {/* WhatsApp Support Button */}
      <a
        href="https://wa.me/263781603382?text=Hi%20ZimFeast%2C%20I%20need%20help%20with..."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-24 right-6 w-14 h-14 rounded-full bg-[#25D366] text-white shadow-lg shadow-green-500/30 hover:shadow-green-500/50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center z-50"
        title="Chat with us on WhatsApp"
      >
        <svg viewBox="0 0 32 32" fill="currentColor" className="w-7 h-7">
          <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16c0 3.5 1.129 6.742 3.047 9.379L1.054 31.27l6.124-1.96A15.907 15.907 0 0 0 16.004 32C24.826 32 32 24.822 32 16S24.826 0 16.004 0zm9.335 22.594c-.39 1.1-1.932 2.013-3.178 2.28-.852.18-1.965.324-5.71-1.227-4.8-1.987-7.886-6.857-8.126-7.175-.23-.318-1.932-2.573-1.932-4.907s1.222-3.48 1.657-3.957c.435-.476.95-.596 1.265-.596.316 0 .63.003.906.016.29.014.68-.11 1.064.812.39.938 1.327 3.232 1.443 3.467.117.236.196.51.04.826-.157.317-.236.514-.47.793-.236.278-.497.622-.71.835-.235.236-.48.49-.207.962.275.47 1.22 2.013 2.62 3.262 1.8 1.607 3.317 2.105 3.787 2.34.47.236.745.197 1.02-.118.275-.316 1.18-1.376 1.495-1.85.316-.476.63-.396 1.063-.237.435.158 2.73 1.288 3.2 1.522.47.237.782.356.898.554.117.197.117 1.14-.274 2.24z" />
        </svg>
      </a>

      <button
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-2xl shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 active:scale-95 transition-all flex items-center justify-center"
      >
        <i className="fas fa-shopping-cart text-xl"></i>
        {cartItems.length > 0 && (
          <span className="absolute -top-2 -right-2 bg-white text-orange-600 text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-orange-500">
            {cartItems.reduce((sum, item) => sum + item.quantity, 0)}
          </span>
        )}
      </button>

      <ChefZimDialog
        isOpen={isChefZimOpen}
        onClose={() => setIsChefZimOpen(false)}
        onRecommendationsReceived={handleAiRecommendations}
      />

      <ChefZimResults
        isOpen={isChefZimResultsOpen}
        onClose={() => setIsChefZimResultsOpen(false)}
        greeting={aiRecommendations.greeting}
        recommendations={aiRecommendations.recommendations}
        closing={aiRecommendations.closing}
        onViewRestaurant={handleSelectRestaurantFromSearch}
      />

      {/* Rating dialog — shown automatically when an order transitions to "delivered" */}
      {deliveredOrder && (
        <RatingDialog
          isOpen={!!deliveredOrder}
          onClose={clearDeliveredOrder}
          orderId={deliveredOrder.orderId}
          restaurantId={deliveredOrder.restaurantId}
          restaurantName={deliveredOrder.restaurantName}
          driverName={deliveredOrder.driverName}
          driverId={deliveredOrder.driverId}
        />
      )}
    </div>
  );
}
