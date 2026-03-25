package eta

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"net/url"
	"sync"
	"time"

	"zimfeast/shared/geo"
)

// Calculator computes delivery ETAs using Google Directions API for road
// distance/duration, time-of-day traffic multipliers, and per-restaurant
// average prep times learned from historical data.
type Calculator struct {
	googleAPIKey string
	httpClient   *http.Client

	// prepTimes stores rolling average prep times (minutes) per restaurant UUID.
	// Updated by RecordPrepTime when orders transition from "paid" → "ready".
	mu        sync.RWMutex
	prepTimes map[string]*rollingAvg
}

// rollingAvg tracks an exponential moving average with a count cap.
type rollingAvg struct {
	Avg   float64 `json:"avg"`
	Count int     `json:"count"`
}

// ETAResult holds the computed ETA breakdown returned to callers.
type ETAResult struct {
	TotalMinutes    float64 `json:"totalMinutes"`
	DrivingMinutes  float64 `json:"drivingMinutes"`
	PrepMinutes     float64 `json:"prepMinutes"`
	PickupBuffer    float64 `json:"pickupBuffer"`
	TrafficMultiply float64 `json:"trafficMultiplier"`
	DistanceKm      float64 `json:"distanceKm"`
	Source          string  `json:"source"` // "google_directions", "haversine_fallback", "tumago"
}

// NewCalculator creates an ETA calculator. Pass the Google Maps API key
// (from GOOGLE_API_KEY env var) to enable Directions API lookups.
// If the key is empty, the calculator falls back to Haversine estimates.
func NewCalculator(googleAPIKey string) *Calculator {
	return &Calculator{
		googleAPIKey: googleAPIKey,
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
		prepTimes: make(map[string]*rollingAvg),
	}
}

const (
	defaultPrepMinutes = 15.0 // default when no historical data exists
	pickupBufferMin    = 2.5  // driver parks and walks in to collect
	avgSpeedKmH        = 30.0 // fallback average speed for Haversine
	minETAMinutes      = 5.0  // minimum ETA returned
)

// Calculate computes the ETA for delivering an order from the restaurant
// to the customer. It tries the Google Directions API first and falls back
// to Haversine-based estimation if the API call fails or no key is set.
func (c *Calculator) Calculate(ctx context.Context, restaurantID string, rLat, rLng, dLat, dLng float64) ETAResult {
	prepMin := c.getPrepTime(restaurantID)
	trafficMul := trafficMultiplier()

	// Try Google Directions API for accurate road duration
	if c.googleAPIKey != "" {
		if driving, distKm, err := c.googleDrivingTime(ctx, rLat, rLng, dLat, dLng); err == nil {
			total := (driving * trafficMul) + prepMin + pickupBufferMin
			return ETAResult{
				TotalMinutes:    math.Max(total, minETAMinutes),
				DrivingMinutes:  driving * trafficMul,
				PrepMinutes:     prepMin,
				PickupBuffer:    pickupBufferMin,
				TrafficMultiply: trafficMul,
				DistanceKm:      distKm,
				Source:          "google_directions",
			}
		}
	}

	// Fallback: Haversine straight-line distance / average speed
	distKm := geo.HaversineDistance(rLat, rLng, dLat, dLng)
	// Multiply by 1.3 to approximate road distance from straight-line
	roadDistKm := distKm * 1.3
	drivingMin := (roadDistKm / avgSpeedKmH) * 60
	total := (drivingMin * trafficMul) + prepMin + pickupBufferMin

	return ETAResult{
		TotalMinutes:    math.Max(total, minETAMinutes),
		DrivingMinutes:  drivingMin * trafficMul,
		PrepMinutes:     prepMin,
		PickupBuffer:    pickupBufferMin,
		TrafficMultiply: trafficMul,
		DistanceKm:      roadDistKm,
		Source:          "haversine_fallback",
	}
}

// CalculateFromDriver computes ETA from a TumaGo driver's current position
// to the delivery address. Used after a driver is assigned and we have
// live location updates.
func (c *Calculator) CalculateFromDriver(ctx context.Context, driverLat, driverLng, deliveryLat, deliveryLng float64) ETAResult {
	trafficMul := trafficMultiplier()

	if c.googleAPIKey != "" {
		if driving, distKm, err := c.googleDrivingTime(ctx, driverLat, driverLng, deliveryLat, deliveryLng); err == nil {
			total := driving * trafficMul
			return ETAResult{
				TotalMinutes:    math.Max(total, minETAMinutes),
				DrivingMinutes:  driving * trafficMul,
				TrafficMultiply: trafficMul,
				DistanceKm:      distKm,
				Source:          "google_directions",
			}
		}
	}

	distKm := geo.HaversineDistance(driverLat, driverLng, deliveryLat, deliveryLng)
	roadDistKm := distKm * 1.3
	drivingMin := (roadDistKm / avgSpeedKmH) * 60
	total := drivingMin * trafficMul

	return ETAResult{
		TotalMinutes:    math.Max(total, minETAMinutes),
		DrivingMinutes:  drivingMin * trafficMul,
		TrafficMultiply: trafficMul,
		DistanceKm:      roadDistKm,
		Source:          "haversine_fallback",
	}
}

// RecordPrepTime updates the rolling average prep time for a restaurant.
// Call this when an order transitions from "paid" → "ready" with the elapsed
// minutes. Uses exponential moving average: new_avg = 0.8*old + 0.2*sample
// after the first 5 samples (simple average for the first 5).
func (c *Calculator) RecordPrepTime(restaurantID string, minutes float64) {
	c.mu.Lock()
	defer c.mu.Unlock()

	ra, exists := c.prepTimes[restaurantID]
	if !exists {
		c.prepTimes[restaurantID] = &rollingAvg{Avg: minutes, Count: 1}
		return
	}

	ra.Count++
	if ra.Count <= 5 {
		// Simple running average for first 5 samples
		ra.Avg = ra.Avg + (minutes-ra.Avg)/float64(ra.Count)
	} else {
		// Exponential moving average: weight recent orders more
		ra.Avg = 0.8*ra.Avg + 0.2*minutes
	}
}

// getPrepTime returns the estimated prep time for a restaurant in minutes.
func (c *Calculator) getPrepTime(restaurantID string) float64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if ra, ok := c.prepTimes[restaurantID]; ok {
		return ra.Avg
	}
	return defaultPrepMinutes
}

// GetPrepTimes returns a copy of all prep time data (for persistence to Redis).
func (c *Calculator) GetPrepTimes() map[string]*rollingAvg {
	c.mu.RLock()
	defer c.mu.RUnlock()
	copy := make(map[string]*rollingAvg, len(c.prepTimes))
	for k, v := range c.prepTimes {
		cp := *v
		copy[k] = &cp
	}
	return copy
}

// RestorePrepTimes loads prep time data from a previously persisted map
// (e.g. from Redis on startup).
func (c *Calculator) RestorePrepTimes(data map[string]*rollingAvg) {
	c.mu.Lock()
	defer c.mu.Unlock()
	for k, v := range data {
		c.prepTimes[k] = v
	}
}

// trafficMultiplier returns a multiplier based on the current time of day
// in Zimbabwe (CAT = UTC+2).
//   - Lunch rush (12:00–14:00): 1.3x
//   - Evening rush (17:00–20:00): 1.2x
//   - Off-peak: 1.0x
func trafficMultiplier() float64 {
	loc, err := time.LoadLocation("Africa/Harare")
	if err != nil {
		// Fallback: UTC+2 manual offset
		loc = time.FixedZone("CAT", 2*60*60)
	}
	hour := time.Now().In(loc).Hour()

	switch {
	case hour >= 12 && hour < 14:
		return 1.3
	case hour >= 17 && hour < 20:
		return 1.2
	default:
		return 1.0
	}
}

// ── Google Directions API ────────────────────────────────────────────

// directionsResponse is the minimal structure we need from the Directions API.
type directionsResponse struct {
	Status string `json:"status"`
	Routes []struct {
		Legs []struct {
			Duration struct {
				Value int `json:"value"` // seconds
			} `json:"duration"`
			Distance struct {
				Value int `json:"value"` // meters
			} `json:"distance"`
		} `json:"legs"`
	} `json:"routes"`
}

// googleDrivingTime calls the Google Directions API and returns the driving
// time in minutes and distance in km for the best route.
func (c *Calculator) googleDrivingTime(ctx context.Context, fromLat, fromLng, toLat, toLng float64) (minutes float64, distKm float64, err error) {
	u, _ := url.Parse("https://maps.googleapis.com/maps/api/directions/json")
	q := u.Query()
	q.Set("origin", fmt.Sprintf("%.6f,%.6f", fromLat, fromLng))
	q.Set("destination", fmt.Sprintf("%.6f,%.6f", toLat, toLng))
	q.Set("mode", "driving")
	q.Set("key", c.googleAPIKey)
	u.RawQuery = q.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return 0, 0, err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		log.Printf("[eta] Google Directions API error: %v", err)
		return 0, 0, err
	}
	defer resp.Body.Close()

	var dr directionsResponse
	if err := json.NewDecoder(resp.Body).Decode(&dr); err != nil {
		return 0, 0, fmt.Errorf("decode directions response: %w", err)
	}

	if dr.Status != "OK" || len(dr.Routes) == 0 || len(dr.Routes[0].Legs) == 0 {
		return 0, 0, fmt.Errorf("directions API status: %s", dr.Status)
	}

	leg := dr.Routes[0].Legs[0]
	minutes = float64(leg.Duration.Value) / 60.0
	distKm = float64(leg.Distance.Value) / 1000.0
	return minutes, distKm, nil
}
