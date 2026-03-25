package geo

import (
	"fmt"
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

// ── PostGIS SQL Helpers ──────────────────────────────────────────────
// These return SQL fragments for use in raw queries against PostGIS-enabled
// databases. They use the geography type for accurate geodesic calculations.

// MakePointSQL returns a SQL expression that creates a PostGIS geography point.
// Example: ST_SetSRID(ST_MakePoint(-17.8, 31.0), 4326)::geography
func MakePointSQL(lng, lat float64) string {
	return fmt.Sprintf("ST_SetSRID(ST_MakePoint(%f, %f), 4326)::geography", lng, lat)
}

// DistanceSQL returns a SQL expression that calculates the geodesic distance
// in meters between a geography column and a point.
func DistanceSQL(column string, lng, lat float64) string {
	return fmt.Sprintf("ST_Distance(%s, %s)", column, MakePointSQL(lng, lat))
}

// DWithinSQL returns a SQL WHERE clause fragment that filters rows within
// a given radius (in meters) of a point using the spatial index.
func DWithinSQL(column string, lng, lat, radiusMeters float64) string {
	return fmt.Sprintf("ST_DWithin(%s, %s, %f)", column, MakePointSQL(lng, lat), radiusMeters)
}
