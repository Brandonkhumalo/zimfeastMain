package fraud

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// Checker performs basic fraud detection using Redis-based counters with TTL.
// All checks are non-blocking — they flag suspicious activity but don't
// prevent orders (the admin is notified and can take action).
type Checker struct {
	rdb *redis.Client
}

// Signal represents a detected fraud signal.
type Signal struct {
	Type    string `json:"type"`    // e.g. "velocity", "geo_anomaly", "cancel_abuse"
	Message string `json:"message"` // human-readable description
	Score   int    `json:"score"`   // severity: 1=low, 2=medium, 3=high
}

// CheckResult aggregates all fraud signals for a single action.
type CheckResult struct {
	Flagged bool     `json:"flagged"` // true if any signal has score >= 2
	Signals []Signal `json:"signals"`
}

func NewChecker(rdb *redis.Client) *Checker {
	return &Checker{rdb: rdb}
}

// ── Order Fraud Checks ──────────────────────────────────────────────

// CheckOrder runs all order-related fraud checks for a customer.
// Call this before confirming a new order.
func (c *Checker) CheckOrder(ctx context.Context, customerID string, deliveryLat, deliveryLng float64) CheckResult {
	var result CheckResult

	// 1. Velocity check: > 3 orders in 10 minutes
	if sig := c.checkVelocity(ctx, customerID); sig != nil {
		result.Signals = append(result.Signals, *sig)
	}

	// 2. Geographic anomaly: delivery far from customer's usual area
	if sig := c.checkGeoAnomaly(ctx, customerID, deliveryLat, deliveryLng); sig != nil {
		result.Signals = append(result.Signals, *sig)
	}

	// 3. Cancel abuse: rapid order-cancel cycles
	if sig := c.checkCancelAbuse(ctx, customerID); sig != nil {
		result.Signals = append(result.Signals, *sig)
	}

	for _, s := range result.Signals {
		if s.Score >= 2 {
			result.Flagged = true
			break
		}
	}

	if result.Flagged {
		log.Printf("[fraud] FLAGGED customer=%s signals=%d", customerID, len(result.Signals))
	}

	return result
}

// RecordOrder increments the order velocity counter for a customer.
// Call this AFTER an order is successfully created.
func (c *Checker) RecordOrder(ctx context.Context, customerID string) {
	key := fmt.Sprintf("fraud:velocity:%s", customerID)
	pipe := c.rdb.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, 10*time.Minute)
	pipe.Exec(ctx)
}

// RecordCancel increments the cancel counter for a customer.
func (c *Checker) RecordCancel(ctx context.Context, customerID string) {
	key := fmt.Sprintf("fraud:cancels:%s", customerID)
	pipe := c.rdb.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, 30*time.Minute)
	pipe.Exec(ctx)
}

// RecordLocation stores the customer's delivery location for geo anomaly detection.
// Stores the last 5 delivery locations.
func (c *Checker) RecordLocation(ctx context.Context, customerID string, lat, lng float64) {
	key := fmt.Sprintf("fraud:locations:%s", customerID)
	val := fmt.Sprintf("%.6f,%.6f", lat, lng)
	pipe := c.rdb.Pipeline()
	pipe.LPush(ctx, key, val)
	pipe.LTrim(ctx, key, 0, 4) // keep last 5
	pipe.Expire(ctx, key, 24*time.Hour)
	pipe.Exec(ctx)
}

// ── Individual Checks ───────────────────────────────────────────────

// checkVelocity flags if the customer has placed > 3 orders in the last 10 minutes.
func (c *Checker) checkVelocity(ctx context.Context, customerID string) *Signal {
	key := fmt.Sprintf("fraud:velocity:%s", customerID)
	count, err := c.rdb.Get(ctx, key).Int()
	if err != nil || count < 3 {
		return nil
	}
	return &Signal{
		Type:    "velocity",
		Message: fmt.Sprintf("Customer placed %d orders in the last 10 minutes", count+1),
		Score:   2,
	}
}

// checkGeoAnomaly flags if the delivery address is > 5km from the customer's
// usual delivery area (average of last 5 locations).
func (c *Checker) checkGeoAnomaly(ctx context.Context, customerID string, lat, lng float64) *Signal {
	key := fmt.Sprintf("fraud:locations:%s", customerID)
	locations, err := c.rdb.LRange(ctx, key, 0, 4).Result()
	if err != nil || len(locations) < 2 {
		return nil // not enough history
	}

	// Calculate centroid of previous locations
	var sumLat, sumLng float64
	var count int
	for _, loc := range locations {
		var pLat, pLng float64
		if _, err := fmt.Sscanf(loc, "%f,%f", &pLat, &pLng); err == nil {
			sumLat += pLat
			sumLng += pLng
			count++
		}
	}
	if count == 0 {
		return nil
	}

	avgLat := sumLat / float64(count)
	avgLng := sumLng / float64(count)

	// Simple distance check (Haversine approximation for short distances)
	// Using the equirectangular approximation for speed
	dLat := (lat - avgLat) * 111.0 // 1 degree lat ~ 111km
	dLng := (lng - avgLng) * 111.0 * 0.85 // cos(-20°) ~ 0.94, but Zimbabwe avg ~0.85
	dist := (dLat*dLat + dLng*dLng)
	if dist < 0 {
		dist = -dist
	}
	// dist is distance squared in km^2, compare to 5km threshold (25 km^2)
	if dist > 25 {
		return &Signal{
			Type:    "geo_anomaly",
			Message: "Delivery address is far from customer's usual delivery area",
			Score:   1,
		}
	}
	return nil
}

// checkCancelAbuse flags if the customer has cancelled > 3 orders in the last 30 minutes.
func (c *Checker) checkCancelAbuse(ctx context.Context, customerID string) *Signal {
	key := fmt.Sprintf("fraud:cancels:%s", customerID)
	count, err := c.rdb.Get(ctx, key).Int()
	if err != nil || count < 3 {
		return nil
	}
	return &Signal{
		Type:    "cancel_abuse",
		Message: fmt.Sprintf("Customer cancelled %d orders in the last 30 minutes", count),
		Score:   2,
	}
}

// ── Payment Fraud Checks ────────────────────────────────────────────

// RecordPaymentFailure increments the failed payment counter for a customer.
func (c *Checker) RecordPaymentFailure(ctx context.Context, customerID string) {
	key := fmt.Sprintf("fraud:pay_fails:%s", customerID)
	pipe := c.rdb.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, 1*time.Hour)
	pipe.Exec(ctx)
}

// CheckPaymentPattern flags if a customer has had multiple failed payments
// followed by a success (potential card testing).
func (c *Checker) CheckPaymentPattern(ctx context.Context, customerID string) *Signal {
	key := fmt.Sprintf("fraud:pay_fails:%s", customerID)
	count, err := c.rdb.Get(ctx, key).Int()
	if err != nil || count < 3 {
		return nil
	}
	return &Signal{
		Type:    "payment_pattern",
		Message: fmt.Sprintf("Customer had %d failed payments before this success", count),
		Score:   2,
	}
}

// ── Promo Abuse Check ───────────────────────────────────────────────

// RecordPromoAttempt records a promo code attempt from an IP/device.
func (c *Checker) RecordPromoAttempt(ctx context.Context, promoCode, customerIP string) {
	key := fmt.Sprintf("fraud:promo:%s:%s", promoCode, customerIP)
	pipe := c.rdb.Pipeline()
	pipe.Incr(ctx, key)
	pipe.Expire(ctx, key, 24*time.Hour)
	pipe.Exec(ctx)
}

// CheckPromoAbuse flags if the same promo code has been attempted multiple times
// from the same IP (potential multi-account promo abuse).
func (c *Checker) CheckPromoAbuse(ctx context.Context, promoCode, customerIP string) *Signal {
	key := fmt.Sprintf("fraud:promo:%s:%s", promoCode, customerIP)
	count, err := c.rdb.Get(ctx, key).Int()
	if err != nil || count < 3 {
		return nil
	}
	return &Signal{
		Type:    "promo_abuse",
		Message: fmt.Sprintf("Promo code %s attempted %d times from same IP", promoCode, count),
		Score:   3,
	}
}
