import { useRef, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Navigation } from "lucide-react";

interface TrackingMapProps {
  /** Driver's current latitude */
  driverLat: number | null;
  /** Driver's current longitude */
  driverLng: number | null;
  /** Restaurant (origin) latitude */
  restaurantLat: number | null;
  /** Restaurant (origin) longitude */
  restaurantLng: number | null;
  /** Customer delivery (destination) latitude */
  deliveryLat: number | null;
  /** Customer delivery (destination) longitude */
  deliveryLng: number | null;
  /** Whether the map should be visible */
  isVisible: boolean;
}

/**
 * TrackingMap - A live delivery tracking map component.
 *
 * Shows:
 * - Google Map centered on the delivery area
 * - Restaurant marker (green, origin)
 * - Customer marker (red, destination)
 * - Driver marker (blue, moves in real-time)
 * - Polyline route between restaurant and customer
 *
 * Uses the Google Maps JavaScript API loaded dynamically via loadGoogleMaps.ts.
 * The driver marker position updates reactively as driverLat/driverLng change.
 */
export default function TrackingMap({
  driverLat,
  driverLng,
  restaurantLat,
  restaurantLng,
  deliveryLat,
  deliveryLng,
  isVisible,
}: TrackingMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const restaurantMarkerRef = useRef<google.maps.Marker | null>(null);
  const deliveryMarkerRef = useRef<google.maps.Marker | null>(null);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const routeRenderedRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  // SVG icon data URIs for markers
  const DRIVER_ICON_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#3b82f6" stroke="#ffffff" stroke-width="1.5">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 16l2-6 6-2-2 6-6 2z" fill="#ffffff" stroke="#3b82f6" stroke-width="1"/>
    </svg>
  `)}`;

  const RESTAURANT_ICON_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#22c55e" stroke="#ffffff" stroke-width="1.5">
      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
      <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
      <path d="M12 3v6"/>
    </svg>
  `)}`;

  const DELIVERY_ICON_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" stroke-width="1.5">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
      <circle cx="12" cy="10" r="3" fill="#ffffff"/>
    </svg>
  `)}`;

  // Initialize the map once when visible and Google Maps is available
  useEffect(() => {
    if (!isVisible || !mapContainerRef.current) return;
    if (mapRef.current) return; // Already initialized

    const google = (window as any).google;
    if (!google?.maps) return;

    // Default center: Harare, Zimbabwe
    const defaultCenter = { lat: -17.8292, lng: 31.0522 };

    mapRef.current = new google.maps.Map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 14,
      disableDefaultUI: false,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
      ],
    });

    // Initialize DirectionsRenderer for route polyline
    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      suppressMarkers: true, // We use custom markers
      polylineOptions: {
        strokeColor: "#3b82f6",
        strokeWeight: 5,
        strokeOpacity: 0.7,
      },
    });
    directionsRendererRef.current.setMap(mapRef.current);

    setMapReady(true);
  }, [isVisible]);

  // Update markers and route whenever coordinates change
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const google = (window as any).google;
    if (!google?.maps) return;

    // --- Restaurant marker ---
    if (restaurantLat != null && restaurantLng != null) {
      const pos = { lat: restaurantLat, lng: restaurantLng };
      if (restaurantMarkerRef.current) {
        restaurantMarkerRef.current.setPosition(pos);
      } else {
        restaurantMarkerRef.current = new google.maps.Marker({
          position: pos,
          map: mapRef.current,
          icon: {
            url: RESTAURANT_ICON_SVG,
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 18),
          },
          title: "Restaurant",
          zIndex: 1,
        });
      }
    }

    // --- Delivery (customer) marker ---
    if (deliveryLat != null && deliveryLng != null) {
      const pos = { lat: deliveryLat, lng: deliveryLng };
      if (deliveryMarkerRef.current) {
        deliveryMarkerRef.current.setPosition(pos);
      } else {
        deliveryMarkerRef.current = new google.maps.Marker({
          position: pos,
          map: mapRef.current,
          icon: {
            url: DELIVERY_ICON_SVG,
            scaledSize: new google.maps.Size(36, 36),
            anchor: new google.maps.Point(18, 36),
          },
          title: "Delivery Location",
          zIndex: 1,
        });
      }
    }

    // --- Driver marker (animated position update) ---
    if (driverLat != null && driverLng != null) {
      const pos = { lat: driverLat, lng: driverLng };
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setPosition(pos);
      } else {
        driverMarkerRef.current = new google.maps.Marker({
          position: pos,
          map: mapRef.current,
          icon: {
            url: DRIVER_ICON_SVG,
            scaledSize: new google.maps.Size(40, 40),
            anchor: new google.maps.Point(20, 20),
          },
          title: "Driver",
          zIndex: 10, // Driver always on top
        });
      }
    }

    // --- Route polyline (render once when both endpoints are known) ---
    if (
      !routeRenderedRef.current &&
      restaurantLat != null && restaurantLng != null &&
      deliveryLat != null && deliveryLng != null &&
      directionsRendererRef.current
    ) {
      const directionsService = new google.maps.DirectionsService();
      directionsService.route(
        {
          origin: { lat: restaurantLat, lng: restaurantLng },
          destination: { lat: deliveryLat, lng: deliveryLng },
          travelMode: google.maps.TravelMode.DRIVING,
        },
        (result: any, status: any) => {
          if (status === google.maps.DirectionsStatus.OK && result) {
            directionsRendererRef.current!.setDirections(result);
            routeRenderedRef.current = true;
          }
        }
      );
    }

    // --- Fit bounds to show all markers ---
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    if (restaurantLat != null && restaurantLng != null) {
      bounds.extend({ lat: restaurantLat, lng: restaurantLng });
      hasPoints = true;
    }
    if (deliveryLat != null && deliveryLng != null) {
      bounds.extend({ lat: deliveryLat, lng: deliveryLng });
      hasPoints = true;
    }
    if (driverLat != null && driverLng != null) {
      bounds.extend({ lat: driverLat, lng: driverLng });
      hasPoints = true;
    }

    if (hasPoints) {
      mapRef.current.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }
  }, [mapReady, driverLat, driverLng, restaurantLat, restaurantLng, deliveryLat, deliveryLng]);

  // Clean up markers and map on unmount or when hidden
  useEffect(() => {
    return () => {
      driverMarkerRef.current?.setMap(null);
      restaurantMarkerRef.current?.setMap(null);
      deliveryMarkerRef.current?.setMap(null);
      directionsRendererRef.current?.setMap(null);

      driverMarkerRef.current = null;
      restaurantMarkerRef.current = null;
      deliveryMarkerRef.current = null;
      directionsRendererRef.current = null;
      mapRef.current = null;
      routeRenderedRef.current = false;
      setMapReady(false);
    };
  }, []);

  if (!isVisible) return null;

  const google = (window as any).google;
  const hasGoogleMaps = !!google?.maps;

  if (!hasGoogleMaps) {
    return (
      <Card className="border rounded-lg overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
          <MapPin className="w-10 h-10 mb-3 opacity-50" />
          <p className="font-medium">Maps not available</p>
          <p className="text-sm">Google Maps API is not loaded</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-lg overflow-hidden border" data-testid="tracking-map-container">
      <div
        ref={mapContainerRef}
        className="w-full h-[350px]"
        data-testid="tracking-map"
      />
      {!mapReady && (
        <Skeleton className="w-full h-[350px] absolute inset-0" />
      )}
      {/* Legend */}
      <div className="flex items-center gap-4 px-3 py-2 bg-muted/50 text-xs">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
          <span>Driver</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
          <span>Restaurant</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />
          <span>You</span>
        </div>
      </div>
    </div>
  );
}
