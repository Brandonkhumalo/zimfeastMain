import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Restaurant } from "@/pages/customer-components/types";

interface UseRestaurantsParams {
  searchTerm: string;
  selectedCuisine: string;
  userLocation: { lat: number; lng: number } | null;
  showNearbyOnly: boolean;
  currency: string;
}

export function useRestaurants({
  selectedCuisine,
  userLocation,
  showNearbyOnly,
}: UseRestaurantsParams) {
  const { toast } = useToast();

  const [restaurantsData, setRestaurantsData] = useState<Restaurant[]>([]);
  const [allRestaurantsData, setAllRestaurantsData] = useState<Restaurant[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursor, setPrevCursor] = useState<string | null>(null);
  const [gridPage, setGridPage] = useState(0);
  const [topPage, setTopPage] = useState(0);

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

  // Re-fetch when filters change
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

  return {
    restaurantsData,
    allRestaurantsData,
    nextCursor,
    prevCursor,
    gridPage,
    setGridPage,
    topPage,
    setTopPage,
    loadNext,
    loadPrev,
  };
}
