import { useEffect, useRef, useState, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search, LocateFixed } from "lucide-react";

declare global {
  interface Window {
    google: any;
    initGoogleMaps?: () => void;
  }
}

interface LocationPickerProps {
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  onLocationChange: (location: {
    lat: number;
    lng: number;
    address: string;
  }) => void;
  height?: string;
  apiKey: string;
}

export default function LocationPicker({
  initialLat,
  initialLng,
  initialAddress = "",
  onLocationChange,
  height = "300px",
  apiKey,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);

  const [address, setAddress] = useState(initialAddress);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const defaultLat = initialLat || -17.8292;
  const defaultLng = initialLng || 31.0522;

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      if (!geocoderRef.current) return;

      geocoderRef.current.geocode(
        { location: { lat, lng } },
        (results: any[], status: string) => {
          if (status === "OK" && results[0]) {
            const formattedAddress = results[0].formatted_address;
            setAddress(formattedAddress);
            onLocationChange({ lat, lng, address: formattedAddress });
          } else {
            onLocationChange({ lat, lng, address: "" });
          }
        }
      );
    },
    [onLocationChange]
  );

  const initializeMap = useCallback(() => {
    if (!mapRef.current || !window.google) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: { lat: defaultLat, lng: defaultLng },
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    mapInstanceRef.current = map;
    geocoderRef.current = new window.google.maps.Geocoder();

    const marker = new window.google.maps.Marker({
      position: { lat: defaultLat, lng: defaultLng },
      map: map,
      draggable: true,
      animation: window.google.maps.Animation.DROP,
      title: "Drag to set location",
    });

    markerRef.current = marker;

    marker.addListener("dragend", () => {
      const position = marker.getPosition();
      if (position) {
        reverseGeocode(position.lat(), position.lng());
      }
    });

    map.addListener("click", (e: any) => {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      marker.setPosition({ lat, lng });
      reverseGeocode(lat, lng);
    });

    if (initialLat && initialLng) {
      reverseGeocode(initialLat, initialLng);
    }

    setIsLoading(false);
  }, [defaultLat, defaultLng, initialLat, initialLng, reverseGeocode]);

  useEffect(() => {
    const loadGoogleMaps = () => {
      if (window.google && window.google.maps) {
        initializeMap();
        return;
      }

      const existingScript = document.querySelector(
        'script[src*="maps.googleapis.com"]'
      );
      if (existingScript) {
        existingScript.addEventListener("load", () => {
          initializeMap();
        });
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        initializeMap();
      };
      script.onerror = () => {
        setError("Failed to load Google Maps");
        setIsLoading(false);
      };
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, [apiKey, initializeMap]);

  useEffect(() => {
    if (!window.google || !window.google.maps || !mapInstanceRef.current)
      return;

    const input = document.getElementById(
      "location-search-input"
    ) as HTMLInputElement;
    if (!input || autocompleteRef.current) return;

    const autocomplete = new window.google.maps.places.Autocomplete(input, {
      componentRestrictions: { country: "zw" },
      fields: ["geometry", "formatted_address", "name"],
    });

    autocompleteRef.current = autocomplete;

    autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      if (!place.geometry || !place.geometry.location) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();
      const formattedAddress = place.formatted_address || place.name || "";

      mapInstanceRef.current.setCenter({ lat, lng });
      mapInstanceRef.current.setZoom(17);
      markerRef.current.setPosition({ lat, lng });

      setAddress(formattedAddress);
      onLocationChange({ lat, lng, address: formattedAddress });
    });
  }, [isLoading, onLocationChange]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        if (mapInstanceRef.current && markerRef.current) {
          mapInstanceRef.current.setCenter({ lat, lng });
          mapInstanceRef.current.setZoom(17);
          markerRef.current.setPosition({ lat, lng });
          reverseGeocode(lat, lng);
        }
        setIsLoading(false);
      },
      (err) => {
        setError("Unable to get your location: " + err.message);
        setIsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (error) {
    return (
      <div
        className="flex items-center justify-center bg-muted rounded-md"
        style={{ height }}
      >
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="location-search-input"
            type="text"
            placeholder="Search for an address..."
            className="pl-10"
            data-testid="input-location-search"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={getCurrentLocation}
          disabled={isLoading}
          data-testid="button-current-location"
        >
          <LocateFixed className="h-4 w-4" />
        </Button>
      </div>

      <div
        ref={mapRef}
        className="rounded-md border overflow-hidden"
        style={{ height }}
        data-testid="map-container"
      >
        {isLoading && (
          <div className="flex items-center justify-center h-full bg-muted">
            <p className="text-muted-foreground">Loading map...</p>
          </div>
        )}
      </div>

      {address && (
        <div className="flex items-start gap-2 p-3 bg-muted rounded-md">
          <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">Selected Location</p>
            <p className="text-sm text-muted-foreground" data-testid="text-selected-address">
              {address}
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Drag the marker or click on the map to adjust the exact location
      </p>
    </div>
  );
}
