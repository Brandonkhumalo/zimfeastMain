import { useState, useEffect, useRef, useCallback } from "react";
import { Wrapper, Status } from "@googlemaps/react-wrapper";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useAuth } from "@/hooks/useAuth";
import { MapPin, Navigation, Clock, Phone } from "lucide-react";

interface DriverLocationMapProps {
  orderId: string;
  isOpen: boolean;
  onClose: () => void;
}

interface DriverLocation {
  lat: number;
  lng: number;
}

interface DriverLocationData {
  orderId: string;
  driverLocation: DriverLocation;
  lastUpdated: string;
  route?: {
    pickupLocation: DriverLocation | null;
    deliveryLocation: DriverLocation | null;
    pickupAddress: string;
    deliveryAddress: string;
  };
  eta?: {
    estimatedArrival: string; // ISO date string
    durationMinutes: number;
    distance: string;
  };
}

interface RenderProps {
  driverLocation?: DriverLocation;
  deliveryLocation?: DriverLocation;
  pickupLocation?: DriverLocation;
  showRoute?: boolean;
  setEta?: (eta: { estimatedArrival: string; durationMinutes: number; distance: string } | undefined) => void;
}

const render = (status: Status, props?: RenderProps) => {
  switch (status) {
    case Status.LOADING:
      return <Skeleton className="w-full h-[300px]" />;
    case Status.FAILURE:
      return (
        <div className="flex items-center justify-center h-[300px] bg-muted rounded-lg">
          <div className="text-center">
            <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-muted-foreground">Unable to load map</p>
          </div>
        </div>
      );
    case Status.SUCCESS:
      return <Map {...props} />;
  }
};

interface MapProps {
  driverLocation?: DriverLocation;
  deliveryLocation?: DriverLocation;
  pickupLocation?: DriverLocation;
  showRoute?: boolean;
  setEta?: (eta: { estimatedArrival: string; durationMinutes: number; distance: string } | undefined) => void;
}

function Map({ driverLocation, deliveryLocation, pickupLocation, showRoute, setEta }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const driverMarker = useRef<any>(null);
  const deliveryMarker = useRef<any>(null);
  const pickupMarker = useRef<any>(null);
  const directionsRenderer = useRef<any>(null);

  useEffect(() => {
    if (mapRef.current && !map.current && typeof window !== 'undefined' && (window as any).google) {
      // Initialize map centered on Harare, Zimbabwe
      const google = (window as any).google;
      map.current = new google.maps.Map(mapRef.current, {
        center: { lat: -17.8292, lng: 31.0522 },
        zoom: 13,
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          }
        ]
      });
    }
  }, []);

  // Separate effect to handle DirectionsRenderer creation when showRoute becomes true
  useEffect(() => {
    if (map.current && showRoute && !directionsRenderer.current && typeof window !== 'undefined' && (window as any).google) {
      const google = (window as any).google;
      directionsRenderer.current = new google.maps.DirectionsRenderer({
        suppressMarkers: true, // We'll use custom markers
        polylineOptions: {
          strokeColor: '#3b82f6',
          strokeWeight: 4,
          strokeOpacity: 0.8,
        }
      });
      directionsRenderer.current.setMap(map.current);
    }
  }, [showRoute]);

  useEffect(() => {
    if (!map.current || typeof window === 'undefined' || !(window as any).google) return;

    const google = (window as any).google;

    // Update driver marker
    if (driverLocation) {
      if (driverMarker.current) {
        driverMarker.current.setPosition(driverLocation);
      } else {
        driverMarker.current = new google.maps.Marker({
          position: driverLocation,
          map: map.current,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2L2 7v10c0 5.55 3.84 10 9 10s9-4.45 9-10V7L12 2z"/>
                <circle cx="12" cy="8" r="2"/>
                <path d="M12 14l-4-2v6h8v-6l-4 2z"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            fillColor: '#3b82f6',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
          title: "Driver Location"
        });
      }

      // Center map on driver location
      map.current.setCenter(driverLocation);
    }

    // Update pickup marker
    if (pickupLocation) {
      if (pickupMarker.current) {
        pickupMarker.current.setPosition(pickupLocation);
      } else {
        pickupMarker.current = new google.maps.Marker({
          position: pickupLocation,
          map: map.current,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"/>
                <path d="m3 9 2.45-4.9A2 2 0 0 1 7.24 3h9.52a2 2 0 0 1 1.8 1.1L21 9"/>
                <path d="M12 3v6"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            fillColor: '#22c55e',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
          title: "Restaurant / Pickup Location"
        });
      }
    }

    // Update delivery marker
    if (deliveryLocation) {
      if (deliveryMarker.current) {
        deliveryMarker.current.setPosition(deliveryLocation);
      } else {
        deliveryMarker.current = new google.maps.Marker({
          position: deliveryLocation,
          map: map.current,
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
            `),
            scaledSize: new google.maps.Size(32, 32),
            fillColor: '#ef4444',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2
          },
          title: "Delivery Location"
        });
      }
    }

    // Calculate and display route if both pickup and delivery locations are available
    if (showRoute && pickupLocation && deliveryLocation && directionsRenderer.current) {
      const directionsService = new google.maps.DirectionsService();
      
      directionsService.route({
        origin: pickupLocation,
        destination: deliveryLocation,
        travelMode: google.maps.TravelMode.DRIVING,
      }, (result: any, status: any) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          directionsRenderer.current.setDirections(result);
        } else {
          console.warn('Route calculation failed:', status);
        }
      });
    }

    // Calculate ETA from driver's current location to delivery (separate from route display)
    if (driverLocation && deliveryLocation && setEta) {
      const directionsService = new google.maps.DirectionsService();
      
      directionsService.route({
        origin: driverLocation,
        destination: deliveryLocation,
        travelMode: google.maps.TravelMode.DRIVING,
      }, (result: any, status: any) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          // Extract duration and distance for ETA calculation
          const route = result.routes[0];
          if (route && route.legs[0]) {
            const leg = route.legs[0];
            const durationMinutes = Math.ceil(leg.duration.value / 60); // Convert seconds to minutes
            const distance = leg.distance.text;
            
            // Calculate estimated arrival time from driver's current position
            const estimatedArrival = new Date(Date.now() + leg.duration.value * 1000).toISOString();
            
            setEta({
              estimatedArrival,
              durationMinutes,
              distance
            });
          }
        } else {
          console.warn('ETA calculation failed:', status);
          setEta?.(undefined);
        }
      });
    }

    // Fit map to show all markers and route
    if (driverLocation || pickupLocation || deliveryLocation) {
      const bounds = new google.maps.LatLngBounds();
      if (driverLocation) bounds.extend(driverLocation);
      if (pickupLocation) bounds.extend(pickupLocation);
      if (deliveryLocation) bounds.extend(deliveryLocation);
      map.current.fitBounds(bounds);
    }
  }, [driverLocation, deliveryLocation, pickupLocation, showRoute]);

  return <div ref={mapRef} className="w-full h-[300px] rounded-lg" data-testid="map-driver-location" />;
}

export default function DriverLocationMap({ orderId, isOpen, onClose }: DriverLocationMapProps) {
  const { user } = useAuth();
  const [driverLocation, setDriverLocation] = useState<DriverLocation | undefined>();
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [eta, setEta] = useState<{ estimatedArrival: string; durationMinutes: number; distance: string } | undefined>();

  // Fetch initial driver location and route data
  const { data: locationData, isLoading } = useQuery<DriverLocationData>({
    queryKey: ['/api/orders', orderId, 'driver-location'],
    enabled: isOpen && !!orderId,
    refetchInterval: 30000, // Refetch every 30 seconds as fallback
  });

  // Memoized WebSocket message handler to prevent connection churn
  const handleWebSocketMessage = useCallback((data: any) => {
    if (data.type === 'DRIVER_LOCATION_UPDATE' && data.orderId === orderId) {
      setDriverLocation(data.location);
      setLastUpdated(data.timestamp);
    }
  }, [orderId]);

  // Set up WebSocket for real-time updates
  useWebSocket('/ws', handleWebSocketMessage);

  useEffect(() => {
    if (locationData) {
      setDriverLocation(locationData.driverLocation);
      setLastUpdated(locationData.lastUpdated);
    }
  }, [locationData]);

  if (!isOpen) {
    return null;
  }

  // Get Google Maps API key from environment
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Card className="m-4 max-w-md w-full">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Track Your Driver</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                data-testid="button-close-driver-tracking"
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">Maps not configured</p>
              <p className="text-sm text-muted-foreground">
                Contact support to enable driver tracking
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="m-4 max-w-2xl w-full max-h-[90vh] overflow-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Navigation className="w-5 h-5" />
              Track Your Driver
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              data-testid="button-close-driver-tracking"
            >
              ✕
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Driver Status */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div>
              <p className="font-medium">Driver Location</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                {lastUpdated ? (
                  <>Last updated: {new Date(lastUpdated).toLocaleTimeString()}</>
                ) : (
                  "Getting location..."
                )}
              </div>
            </div>
            <div className="text-right">
              <Badge variant={driverLocation ? "default" : "secondary"} data-testid="badge-driver-status">
                {driverLocation ? "Live" : "Offline"}
              </Badge>
              {/* ETA Display */}
              {eta && (
                <div className="mt-1 text-sm" data-testid="eta-display">
                  <div className="font-medium text-blue-600">
                    ETA: {new Date(eta.estimatedArrival).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {eta.durationMinutes}m • {eta.distance}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Google Map */}
          <div className="border rounded-lg overflow-hidden">
            {isLoading ? (
              <Skeleton className="w-full h-[300px]" />
            ) : (
              <Wrapper 
                apiKey={apiKey} 
                render={(status: Status) => render(status, {
                  driverLocation,
                  deliveryLocation: locationData?.route?.deliveryLocation as DriverLocation,
                  pickupLocation: locationData?.route?.pickupLocation as DriverLocation,
                  showRoute: !!(locationData?.route?.pickupLocation && locationData?.route?.deliveryLocation),
                  setEta,
                })}
              />
            )}
          </div>

          {/* Delivery Timeline */}
          {eta && (
            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800" data-testid="delivery-timeline">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Delivery Timeline
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Driver departed</span>
                  </div>
                  <span className="text-xs text-muted-foreground">Now</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium">Estimated arrival</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-blue-600">
                      {new Date(eta.estimatedArrival).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {eta.durationMinutes} min • {eta.distance}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Location Details */}
          {driverLocation && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium mb-1">Latitude</p>
                <p className="text-muted-foreground">{driverLocation.lat.toFixed(6)}</p>
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium mb-1">Longitude</p>
                <p className="text-muted-foreground">{driverLocation.lng.toFixed(6)}</p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" data-testid="button-call-driver">
              <Phone className="w-4 h-4 mr-2" />
              Call Driver
            </Button>
            <Button variant="outline" className="flex-1" data-testid="button-refresh-location">
              <Navigation className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>

          {!driverLocation && !isLoading && (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Driver location not available</p>
              <p className="text-sm">Your driver may not have started delivery yet</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}