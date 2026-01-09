// Shared utility functions for delivery fee calculation
// This ensures consistent calculation across frontend and backend

// Delivery rate per kilometer
export const DELIVERY_RATE_PER_KM = 0.35;

// Calculate distance between two coordinates using Haversine formula
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in kilometers
}

// Calculate delivery fee at $0.35 per km with minimum base fee
export function calculateDeliveryFee(distance: number): number {
  const baseFee = 1.50; // Minimum delivery fee
  return Math.max(baseFee, distance * DELIVERY_RATE_PER_KM);
}

// Calculate delivery fee from coordinates
export function calculateDeliveryFeeFromCoordinates(
  customerLat: number,
  customerLng: number,
  restaurantLat: number,
  restaurantLng: number
): number {
  const distance = calculateDistance(customerLat, customerLng, restaurantLat, restaurantLng);
  return calculateDeliveryFee(distance);
}

// Calculate multi-restaurant delivery fee
// Formula: (distance between restaurants * rate) + (last restaurant to delivery * rate)
export function calculateMultiRestaurantDeliveryFee(
  restaurants: Array<{lat: number, lng: number}>,
  deliveryLat: number,
  deliveryLng: number
): { totalFee: number, totalDistance: number } {
  if (restaurants.length === 0) {
    return { totalFee: 0, totalDistance: 0 };
  }
  
  if (restaurants.length === 1) {
    const distance = calculateDistance(
      restaurants[0].lat, restaurants[0].lng,
      deliveryLat, deliveryLng
    );
    return { 
      totalFee: Math.max(1.50, distance * DELIVERY_RATE_PER_KM), 
      totalDistance: distance 
    };
  }
  
  let totalDistance = 0;
  
  // Calculate distances between consecutive restaurants
  for (let i = 0; i < restaurants.length - 1; i++) {
    totalDistance += calculateDistance(
      restaurants[i].lat, restaurants[i].lng,
      restaurants[i + 1].lat, restaurants[i + 1].lng
    );
  }
  
  // Add distance from last restaurant to delivery address
  const lastRestaurant = restaurants[restaurants.length - 1];
  totalDistance += calculateDistance(
    lastRestaurant.lat, lastRestaurant.lng,
    deliveryLat, deliveryLng
  );
  
  return { 
    totalFee: Math.max(1.50, totalDistance * DELIVERY_RATE_PER_KM), 
    totalDistance 
  };
}

// Default delivery fee when coordinates are not available
export const DEFAULT_DELIVERY_FEE = 3.00;