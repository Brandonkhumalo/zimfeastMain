// Driver assignment utilities for finding and assigning nearest available drivers
import { calculateDistance } from './deliveryUtils';

export interface DriverLocation {
  userId: string;
  driverId: string;
  coordinates: { lat: number; lng: number };
  isAvailable: boolean;
  locationUpdatedAt: Date;
}

export interface OrderLocation {
  orderId: string;
  restaurantCoordinates: { lat: number; lng: number };
  deliveryCoordinates: { lat: number; lng: number };
  declinedDrivers: string[]; // Array of driver user IDs who declined
}

// Find the nearest available driver for an order
export function findNearestAvailableDriver(
  availableDrivers: DriverLocation[],
  orderLocation: OrderLocation,
  maxDistanceKm: number = 10
): DriverLocation | null {
  // Filter out drivers who have declined this order
  const eligibleDrivers = availableDrivers.filter(driver => 
    driver.isAvailable && 
    !orderLocation.declinedDrivers.includes(driver.userId) &&
    // Only consider drivers with recent location updates (within last 5 minutes)
    driver.locationUpdatedAt && 
    Date.now() - driver.locationUpdatedAt.getTime() < 5 * 60 * 1000
  );

  if (eligibleDrivers.length === 0) {
    return null;
  }

  // Calculate distances from restaurant location
  const driversWithDistance = eligibleDrivers.map(driver => {
    const distance = calculateDistance(
      orderLocation.restaurantCoordinates.lat,
      orderLocation.restaurantCoordinates.lng,
      driver.coordinates.lat,
      driver.coordinates.lng
    );
    return { ...driver, distance };
  });

  // Filter drivers within maximum distance and sort by distance
  const nearbyDrivers = driversWithDistance
    .filter(driver => driver.distance <= maxDistanceKm)
    .sort((a, b) => a.distance - b.distance);

  return nearbyDrivers.length > 0 ? nearbyDrivers[0] : null;
}

// Check if driver location is stale (last updated more than 5 minutes ago)
export function isDriverLocationStale(lastUpdated: Date): boolean {
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  return lastUpdated.getTime() < fiveMinutesAgo;
}

// Get distance between driver and restaurant in kilometers
export function getDriverRestaurantDistance(
  driverCoords: { lat: number; lng: number },
  restaurantCoords: { lat: number; lng: number }
): number {
  return calculateDistance(
    driverCoords.lat,
    driverCoords.lng,
    restaurantCoords.lat,
    restaurantCoords.lng
  );
}