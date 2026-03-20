import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export function useUserLocation() {
  const { toast } = useToast();

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showNearbyOnly, setShowNearbyOnly] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

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

  const toggleNearbyView = () => {
    if (!showNearbyOnly) {
      if (userLocation) setShowNearbyOnly(true);
      else getCurrentLocation();
    } else {
      setShowNearbyOnly(false);
    }
  };

  return {
    userLocation,
    setUserLocation,
    showNearbyOnly,
    setShowNearbyOnly,
    isGettingLocation,
    getCurrentLocation,
    toggleNearbyView,
  };
}
