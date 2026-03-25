package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"
	"zimfeast/shared/response"
	"zimfeast/shared/tumago"
)

// TumaGoWebhook handles POST /api/webhooks/tumago/
// It receives delivery status updates from TumaGo's Partner API and updates
// the corresponding ZimFeast order accordingly.
func (h *Handler) TumaGoWebhook(w http.ResponseWriter, r *http.Request) {
	// Read the raw body so we can verify the signature before parsing
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("[webhook] failed to read request body: %v", err)
		response.Error(w, http.StatusBadRequest, "Failed to read request body")
		return
	}

	// Verify the webhook signature using HMAC-SHA256
	signature := r.Header.Get("X-TumaGo-Signature")
	if signature == "" {
		log.Println("[webhook] missing X-TumaGo-Signature header")
		response.Error(w, http.StatusUnauthorized, "Missing signature")
		return
	}

	if !h.tumago.VerifyWebhookSignature(body, signature) {
		log.Println("[webhook] invalid signature")
		response.Error(w, http.StatusUnauthorized, "Invalid signature")
		return
	}

	// Parse the event type from the header
	eventType := r.Header.Get("X-TumaGo-Event")
	if eventType == "" {
		log.Println("[webhook] missing X-TumaGo-Event header")
		response.Error(w, http.StatusBadRequest, "Missing event type")
		return
	}

	// Parse the webhook payload
	var payload tumago.WebhookPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		log.Printf("[webhook] failed to parse payload: %v", err)
		response.Error(w, http.StatusBadRequest, "Invalid payload")
		return
	}

	log.Printf("[webhook] received event=%s delivery_id=%s partner_ref=%s",
		eventType, payload.DeliveryID, payload.PartnerReference)

	// Look up the ZimFeast order by tumago_delivery_id or by partner_reference
	// (partner_reference is the ZimFeast order ID)
	orderID, err := h.resolveOrderID(r.Context(), payload)
	if err != nil {
		log.Printf("[webhook] order not found for delivery_id=%s partner_ref=%s: %v",
			payload.DeliveryID, payload.PartnerReference, err)
		response.Error(w, http.StatusNotFound, "Order not found")
		return
	}

	// Route to the appropriate handler based on event type
	ctx := r.Context()
	var handleErr error
	switch eventType {
	case "driver_assigned":
		handleErr = h.handleDriverAssigned(ctx, orderID, payload)
	case "location_update":
		handleErr = h.handleLocationUpdate(ctx, orderID, payload)
	case "picked_up":
		handleErr = h.handlePickedUp(ctx, orderID, payload)
	case "delivered":
		handleErr = h.handleDelivered(ctx, orderID, payload)
	case "cancelled":
		handleErr = h.handleCancelled(ctx, orderID, payload)
	default:
		log.Printf("[webhook] unknown event type: %s", eventType)
		response.Error(w, http.StatusBadRequest, "Unknown event type: "+eventType)
		return
	}

	if handleErr != nil {
		log.Printf("[webhook] failed to handle event=%s order=%s: %v", eventType, orderID, handleErr)
		response.Error(w, http.StatusInternalServerError, "Failed to process webhook")
		return
	}

	response.OK(w, map[string]string{"status": "ok"})
}

// resolveOrderID finds the ZimFeast order ID from either the tumago_delivery_id
// or the partner_reference (which is the ZimFeast order ID itself).
func (h *Handler) resolveOrderID(ctx context.Context, payload tumago.WebhookPayload) (string, error) {
	var orderID string

	// First try by tumago_delivery_id
	if payload.DeliveryID != "" {
		err := h.db.QueryRow(ctx,
			`SELECT id FROM orders_order WHERE tumago_delivery_id = $1`,
			payload.DeliveryID).Scan(&orderID)
		if err == nil {
			return orderID, nil
		}
		if err != pgx.ErrNoRows {
			return "", fmt.Errorf("db error looking up tumago_delivery_id=%s: %w", payload.DeliveryID, err)
		}
	}

	// Fall back to partner_reference (which is the ZimFeast order ID)
	if payload.PartnerReference != "" {
		err := h.db.QueryRow(ctx,
			`SELECT id FROM orders_order WHERE id = $1`,
			payload.PartnerReference).Scan(&orderID)
		if err == nil {
			return orderID, nil
		}
		if err != pgx.ErrNoRows {
			return "", fmt.Errorf("db error looking up partner_ref=%s: %w", payload.PartnerReference, err)
		}
	}

	return "", fmt.Errorf("no order found for delivery_id=%s or partner_ref=%s",
		payload.DeliveryID, payload.PartnerReference)
}

// handleDriverAssigned stores driver info on the order and transitions status
// to "assigned". TumaGo sends driver/vehicle as nested objects:
//
//	{"driver": {"name":"...","phone":"...","rating":4.5}, "vehicle": {"type":"...","name":"...",...}}
func (h *Handler) handleDriverAssigned(ctx context.Context, orderID string, payload tumago.WebhookPayload) error {
	var driverName, driverPhone string
	if payload.Driver != nil {
		driverName = payload.Driver.Name
		driverPhone = payload.Driver.Phone
	}

	// Serialize vehicle map to JSON string for storage
	var vehicleJSON *string
	if payload.Vehicle != nil {
		b, err := json.Marshal(payload.Vehicle)
		if err == nil {
			s := string(b)
			vehicleJSON = &s
		}
	}

	_, err := h.db.Exec(ctx,
		`UPDATE orders_order
		 SET status = 'assigned',
		     driver_name = $1,
		     driver_phone = $2,
		     driver_vehicle = $3
		 WHERE id = $4`,
		driverName, driverPhone, vehicleJSON, orderID)
	if err != nil {
		return fmt.Errorf("update order %s for driver_assigned: %w", orderID, err)
	}

	log.Printf("[webhook] order %s → assigned (driver: %s)", orderID, driverName)
	h.pub.PublishOrderStatus(ctx, orderID, "assigned")
	return nil
}

// handleLocationUpdate publishes the driver's current lat/lng to a Redis
// channel so real-time consumers (WebSocket service, etc.) can relay it.
// TumaGo sends location as: {"driver_location": {"lat": -17.8, "lng": 31.0}}
func (h *Handler) handleLocationUpdate(ctx context.Context, orderID string, payload tumago.WebhookPayload) error {
	var lat, lng float64
	if payload.DriverLocation != nil {
		lat = payload.DriverLocation.Lat
		lng = payload.DriverLocation.Lng
	}

	h.pub.Publish(ctx, "orders.driver.location", map[string]interface{}{
		"orderId":   orderID,
		"driverLat": lat,
		"driverLng": lng,
	})
	log.Printf("[webhook] location update for order %s: lat=%.6f lng=%.6f",
		orderID, lat, lng)
	return nil
}

// handlePickedUp transitions the order to "out_for_delivery".
func (h *Handler) handlePickedUp(ctx context.Context, orderID string, payload tumago.WebhookPayload) error {
	_, err := h.db.Exec(ctx,
		`UPDATE orders_order SET status = 'out_for_delivery', delivery_out_time = NOW() WHERE id = $1`,
		orderID)
	if err != nil {
		return fmt.Errorf("update order %s for picked_up: %w", orderID, err)
	}

	log.Printf("[webhook] order %s → out_for_delivery", orderID)
	h.pub.PublishOrderStatus(ctx, orderID, "out_for_delivery")
	return nil
}

// handleDelivered transitions the order to "delivered" and records the
// delivery completion timestamp.
func (h *Handler) handleDelivered(ctx context.Context, orderID string, payload tumago.WebhookPayload) error {
	_, err := h.db.Exec(ctx,
		`UPDATE orders_order SET status = 'delivered', delivery_complete_time = NOW() WHERE id = $1`,
		orderID)
	if err != nil {
		return fmt.Errorf("update order %s for delivered: %w", orderID, err)
	}

	log.Printf("[webhook] order %s → delivered", orderID)
	h.pub.PublishOrderStatus(ctx, orderID, "delivered")
	return nil
}

// handleCancelled transitions the order to "cancelled".
func (h *Handler) handleCancelled(ctx context.Context, orderID string, payload tumago.WebhookPayload) error {
	_, err := h.db.Exec(ctx,
		`UPDATE orders_order SET status = 'cancelled' WHERE id = $1`, orderID)
	if err != nil {
		return fmt.Errorf("update order %s for cancelled: %w", orderID, err)
	}

	log.Printf("[webhook] order %s → cancelled", orderID)
	h.pub.PublishOrderStatus(ctx, orderID, "cancelled")
	return nil
}
