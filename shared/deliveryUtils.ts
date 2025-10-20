// Shared utility functions for delivery fee calculation
// This ensures consistent calculation across frontend and backend

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
  const ratePerKm = 0.35;
  const baseFee = 1.50; // Minimum delivery fee
  return Math.max(baseFee, distance * ratePerKm);
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

// Default delivery fee when coordinates are not available
export const DEFAULT_DELIVERY_FEE = 3.00;