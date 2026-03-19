package geo

import (
	"math"
)

const earthRadiusKm = 6371.0

// HaversineDistance calculates the great-circle distance between two points in km.
func HaversineDistance(lat1, lng1, lat2, lng2 float64) float64 {
	dLat := toRadians(lat2 - lat1)
	dLng := toRadians(lng2 - lng1)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(toRadians(lat1))*math.Cos(toRadians(lat2))*
			math.Sin(dLng/2)*math.Sin(dLng/2)

	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusKm * c
}

// CalculateDeliveryFee computes the delivery fee based on distance.
// Rate: $0.35/km, minimum $1.50
func CalculateDeliveryFee(restaurantLat, restaurantLng, deliveryLat, deliveryLng float64) float64 {
	dist := HaversineDistance(restaurantLat, restaurantLng, deliveryLat, deliveryLng)
	fee := dist * 0.35
	if fee < 1.50 {
		fee = 1.50
	}
	return math.Round(fee*100) / 100
}

// IsWithinZimbabwe checks if coordinates fall within Zimbabwe's bounding box.
func IsWithinZimbabwe(lat, lng float64) bool {
	return lat >= -22.5 && lat <= -15.3 && lng >= 25.2 && lng <= 33.1
}

func toRadians(deg float64) float64 {
	return deg * math.Pi / 180
}
