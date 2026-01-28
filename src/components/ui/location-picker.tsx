import { useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker, Autocomplete } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search, LocateFixed } from "lucide-react";

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

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ["places"];

export default function LocationPicker({
  initialLat,
  initialLng,
  initialAddress = "",
  onLocationChange,
  height = "300px",
  apiKey,
}: LocationPickerProps) {
  const [address, setAddress] = useState(initialAddress);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markerPosition, setMarkerPosition] = useState({
    lat: initialLat || -17.8292,
    lng: initialLng || 31.0522,
  });
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
    libraries,
  });

  const reverseGeocode = useCallback(
    (lat: number, lng: number) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode(
        { location: { lat, lng } },
        (results: google.maps.GeocoderResult[] | null, status: google.maps.GeocoderStatus) => {
          if (status === "OK" && results && results[0]) {
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

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      reverseGeocode(lat, lng);
    }
  }, [reverseGeocode]);

  const onMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      reverseGeocode(lat, lng);
    }
  }, [reverseGeocode]);

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const formattedAddress = place.formatted_address || place.name || "";
        
        setMarkerPosition({ lat, lng });
        setAddress(formattedAddress);
        map?.panTo({ lat, lng });
        map?.setZoom(17);
        onLocationChange({ lat, lng, address: formattedAddress });
      }
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setMarkerPosition({ lat, lng });
        map?.panTo({ lat, lng });
        map?.setZoom(17);
        reverseGeocode(lat, lng);
      },
      undefined,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (loadError) {
    return (
      <div className="flex items-center justify-center bg-muted rounded-md" style={{ height }}>
        <p className="text-destructive">Failed to load Google Maps</p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center bg-muted rounded-md" style={{ height }}>
        <p className="text-muted-foreground">Loading map...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Autocomplete
            onLoad={(ac) => setAutocomplete(ac)}
            onPlaceChanged={onPlaceChanged}
            options={{ componentRestrictions: { country: "zw" } }}
          >
            <Input
              type="text"
              placeholder="Search for an address..."
              className="pl-10"
              data-testid="input-location-search"
            />
          </Autocomplete>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={getCurrentLocation}
          data-testid="button-current-location"
        >
          <LocateFixed className="h-4 w-4" />
        </Button>
      </div>

      <div className="rounded-md border overflow-hidden relative" style={{ height }}>
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={markerPosition}
          zoom={15}
          onClick={onMapClick}
          onLoad={(map) => setMap(map)}
          options={{
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
          }}
        >
          <Marker
            position={markerPosition}
            draggable={true}
            onDragEnd={onMarkerDragEnd}
            animation={google.maps.Animation.DROP}
          />
        </GoogleMap>
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
