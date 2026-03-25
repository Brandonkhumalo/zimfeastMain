package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"zimfeast/shared/auth"
	"zimfeast/shared/config"
	"zimfeast/shared/fraud"
	"zimfeast/shared/geo"
	"zimfeast/shared/redispub"
	"zimfeast/shared/response"
	"zimfeast/shared/tumago"
)

type Handler struct {
	db     *pgxpool.Pool
	pub    *redispub.Publisher
	cfg    *config.Config
	tumago *tumago.Client
	fraud  *fraud.Checker
}

// validTransitions defines the allowed order status state machine.
// Each key maps to the set of statuses it can transition to.
// The "ready" → "awaiting_driver" transition is automatic: when an order
// reaches "ready", the UpdateStatus handler calls TumaGo to request a driver,
// stores the tumago_delivery_id, and moves the order to "awaiting_driver".
// From there, TumaGo webhooks drive the remaining transitions.
var validTransitions = map[string][]string{
	"scheduled":        {"pending_payment", "cancelled"},
	"pending_payment":  {"paid", "cancelled"},
	"paid":             {"preparing", "cancelled"},
	"preparing":        {"ready"},
	"ready":            {"awaiting_driver"},
	"awaiting_driver":  {"assigned", "cancelled"},
	"assigned":         {"out_for_delivery", "cancelled"},
	"out_for_delivery": {"delivered"},
}

// isValidTransition checks whether transitioning from one status to another is allowed.
func isValidTransition(from, to string) bool {
	allowed, ok := validTransitions[from]
	if !ok {
		return false
	}
	for _, s := range allowed {
		if s == to {
			return true
		}
	}
	return false
}

func New(db *pgxpool.Pool, pub *redispub.Publisher, cfg *config.Config, tc *tumago.Client, fc *fraud.Checker) *Handler {
	return &Handler{db: db, pub: pub, cfg: cfg, tumago: tc, fraud: fc}
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	response.OK(w, map[string]string{"status": "ok"})
}

// CreateOrder handles POST /api/orders/create/
func (h *Handler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var body struct {
		RestaurantID    string  `json:"restaurant_id"`
		RestaurantNames string  `json:"restaurant_names"`
		RestaurantLat   float64 `json:"restaurant_lat"`
		RestaurantLng   float64 `json:"restaurant_lng"`
		DeliveryLat     float64 `json:"delivery_lat"`
		DeliveryLng     float64 `json:"delivery_lng"`
		DeliveryAddress string  `json:"delivery_address"`
		Method          string  `json:"method"`
		Tip             float64 `json:"tip"`
		ScheduledFor    string  `json:"scheduled_for"` // Optional ISO 8601 datetime for scheduled orders
		Items           []struct {
			MenuItemID    string  `json:"menu_item_id"`
			MenuItemName  string  `json:"menu_item_name"`
			MenuItemPrice float64 `json:"menu_item_price"`
			Quantity      int     `json:"quantity"`
		} `json:"items"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Method == "" {
		body.Method = "delivery"
	}

	// Validate delivery address is within Zimbabwe
	if body.Method == "delivery" && !geo.IsWithinZimbabwe(body.DeliveryLat, body.DeliveryLng) {
		response.Error(w, http.StatusBadRequest, "Delivery address must be within Zimbabwe")
		return
	}

	// Calculate delivery fee
	var deliveryFee float64
	if body.Method == "delivery" {
		deliveryFee = geo.CalculateDeliveryFee(body.RestaurantLat, body.RestaurantLng, body.DeliveryLat, body.DeliveryLng)
	}

	// Calculate total
	var totalFee float64
	eachItemPrice := make([]map[string]interface{}, 0)
	for _, item := range body.Items {
		itemTotal := item.MenuItemPrice * float64(item.Quantity)
		totalFee += itemTotal
		eachItemPrice = append(eachItemPrice, map[string]interface{}{
			"name":     item.MenuItemName,
			"price":    item.MenuItemPrice,
			"quantity": item.Quantity,
			"total":    itemTotal,
		})
	}
	totalFee += deliveryFee + body.Tip

	eachItemPriceJSON, err := json.Marshal(eachItemPrice)
	if err != nil {
		log.Printf("[order] failed to marshal each_item_price: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to process item prices")
		return
	}

	// Determine initial status and parse scheduled_for if provided.
	// If the client sends a scheduled_for timestamp, the order starts as "scheduled"
	// and a background dispatcher will transition it to "pending_payment" when the
	// scheduled time arrives.
	initialStatus := "pending_payment"
	var scheduledFor *time.Time
	if body.ScheduledFor != "" {
		parsed, parseErr := time.Parse(time.RFC3339, body.ScheduledFor)
		if parseErr != nil {
			response.Error(w, http.StatusBadRequest, "Invalid scheduled_for format. Use ISO 8601 (e.g. 2026-03-20T12:00:00Z)")
			return
		}
		// Scheduled time must be in the future
		if parsed.Before(time.Now()) {
			response.Error(w, http.StatusBadRequest, "scheduled_for must be in the future")
			return
		}
		scheduledFor = &parsed
		initialStatus = "scheduled"
	}

	// Run fraud checks (non-blocking: flags suspicious orders but doesn't prevent them)
	var fraudResult *fraud.CheckResult
	if h.fraud != nil {
		fr := h.fraud.CheckOrder(r.Context(), user.ID, body.DeliveryLat, body.DeliveryLng)
		if fr.Flagged {
			fraudResult = &fr
		}
	}

	orderID := uuid.New()

	tx, err := h.db.Begin(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Transaction failed")
		return
	}
	defer tx.Rollback(r.Context())

	_, err = tx.Exec(r.Context(),
		`INSERT INTO orders_order (
			id, status, method, customer_id, restaurant_id,
			total_fee, tip, delivery_fee, each_item_price,
			restaurant_lat, restaurant_lng, delivery_lat, delivery_lng, delivery_address,
			restaurant_names, scheduled_for, created
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())`,
		orderID, initialStatus, body.Method, user.ID, body.RestaurantID,
		totalFee, body.Tip, deliveryFee, string(eachItemPriceJSON),
		body.RestaurantLat, body.RestaurantLng, body.DeliveryLat, body.DeliveryLng, body.DeliveryAddress,
		body.RestaurantNames, scheduledFor)
	if err != nil {
		log.Printf("[order] create error: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to create order")
		return
	}

	// Create order items
	for _, item := range body.Items {
		_, err = tx.Exec(r.Context(),
			`INSERT INTO orders_orderitem (id, order_id, user_id, menu_item_id, menu_item_name, menu_item_price, quantity, added)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
			uuid.New(), orderID, user.ID, item.MenuItemID, item.MenuItemName, item.MenuItemPrice, item.Quantity)
		if err != nil {
			log.Printf("[order] create item error: %v", err)
			response.Error(w, http.StatusInternalServerError, "Failed to create order item")
			return
		}
	}

	if err := tx.Commit(r.Context()); err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to commit order")
		return
	}

	// Record order for fraud velocity tracking and store delivery location
	if h.fraud != nil {
		h.fraud.RecordOrder(r.Context(), user.ID)
		h.fraud.RecordLocation(r.Context(), user.ID, body.DeliveryLat, body.DeliveryLng)

		// Publish fraud alert to Redis for admin notification
		if fraudResult != nil {
			h.pub.Publish(r.Context(), "orders.fraud.flagged", map[string]interface{}{
				"orderId":    orderID.String(),
				"customerId": user.ID,
				"signals":    fraudResult.Signals,
			})
		}
	}

	// Return created order
	order := h.fetchOrder(r.Context(), orderID.String())
	response.Created(w, order)
}

// ListOrders handles GET /api/orders/list/ with role-based filtering
func (h *Handler) ListOrders(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	role := user.Role
	if role == "" {
		role = "customer"
	}

	cursor := r.URL.Query().Get("cursor")
	limit := 50

	var query string
	var args []interface{}

	switch role {
	case "customer":
		if cursor != "" {
			cursorTime, _ := time.Parse(time.RFC3339Nano, cursor)
			query = `SELECT id, status, method, customer_id, driver_id, restaurant_id,
				total_fee, tip, delivery_fee, each_item_price,
				restaurant_lat, restaurant_lng, delivery_lat, delivery_lng, delivery_address,
				driver_name, driver_phone, driver_vehicle, restaurant_names,
				external_order_numbers, scheduled_for, created, delivery_out_time, delivery_complete_time,
				preparing_started_at, delivery_photo, tumago_delivery_id
				FROM orders_order WHERE customer_id = $1 AND created < $2
				ORDER BY created DESC LIMIT $3`
			args = []interface{}{user.ID, cursorTime, limit + 1}
		} else {
			query = `SELECT id, status, method, customer_id, driver_id, restaurant_id,
				total_fee, tip, delivery_fee, each_item_price,
				restaurant_lat, restaurant_lng, delivery_lat, delivery_lng, delivery_address,
				driver_name, driver_phone, driver_vehicle, restaurant_names,
				external_order_numbers, scheduled_for, created, delivery_out_time, delivery_complete_time,
				preparing_started_at, delivery_photo, tumago_delivery_id
				FROM orders_order WHERE customer_id = $1
				ORDER BY created DESC LIMIT $2`
			args = []interface{}{user.ID, limit + 1}
		}
	case "driver":
		if cursor != "" {
			cursorTime, _ := time.Parse(time.RFC3339Nano, cursor)
			query = `SELECT id, status, method, customer_id, driver_id, restaurant_id,
				total_fee, tip, delivery_fee, each_item_price,
				restaurant_lat, restaurant_lng, delivery_lat, delivery_lng, delivery_address,
				driver_name, driver_phone, driver_vehicle, restaurant_names,
				external_order_numbers, scheduled_for, created, delivery_out_time, delivery_complete_time,
				preparing_started_at, delivery_photo, tumago_delivery_id
				FROM orders_order WHERE driver_id = $1 AND created < $2
				ORDER BY created DESC LIMIT $3`
			args = []interface{}{user.ID, cursorTime, limit + 1}
		} else {
			query = `SELECT id, status, method, customer_id, driver_id, restaurant_id,
				total_fee, tip, delivery_fee, each_item_price,
				restaurant_lat, restaurant_lng, delivery_lat, delivery_lng, delivery_address,
				driver_name, driver_phone, driver_vehicle, restaurant_names,
				external_order_numbers, scheduled_for, created, delivery_out_time, delivery_complete_time,
				preparing_started_at, delivery_photo, tumago_delivery_id
				FROM orders_order WHERE driver_id = $1
				ORDER BY created DESC LIMIT $2`
			args = []interface{}{user.ID, limit + 1}
		}
	case "restaurant":
		if cursor != "" {
			cursorTime, _ := time.Parse(time.RFC3339Nano, cursor)
			query = `SELECT id, status, method, customer_id, driver_id, restaurant_id,
				total_fee, tip, delivery_fee, each_item_price,
				restaurant_lat, restaurant_lng, delivery_lat, delivery_lng, delivery_address,
				driver_name, driver_phone, driver_vehicle, restaurant_names,
				external_order_numbers, scheduled_for, created, delivery_out_time, delivery_complete_time,
				preparing_started_at, delivery_photo, tumago_delivery_id
				FROM orders_order WHERE restaurant_id = $1 AND status NOT IN ('pending_payment', 'scheduled') AND created < $2
				ORDER BY created DESC LIMIT $3`
			args = []interface{}{user.ID, cursorTime, limit + 1}
		} else {
			query = `SELECT id, status, method, customer_id, driver_id, restaurant_id,
				total_fee, tip, delivery_fee, each_item_price,
				restaurant_lat, restaurant_lng, delivery_lat, delivery_lng, delivery_address,
				driver_name, driver_phone, driver_vehicle, restaurant_names,
				external_order_numbers, scheduled_for, created, delivery_out_time, delivery_complete_time,
				preparing_started_at, delivery_photo, tumago_delivery_id
				FROM orders_order WHERE restaurant_id = $1 AND status NOT IN ('pending_payment', 'scheduled')
				ORDER BY created DESC LIMIT $2`
			args = []interface{}{user.ID, limit + 1}
		}
	default:
		response.Error(w, http.StatusForbidden, "Invalid role")
		return
	}

	rows, err := h.db.Query(r.Context(), query, args...)
	if err != nil {
		log.Printf("[order] list error: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to fetch orders")
		return
	}
	defer rows.Close()

	orders := h.scanOrders(rows)

	var nextCursor *string
	if len(orders) > limit {
		orders = orders[:limit]
		if created, ok := orders[limit-1]["created"].(string); ok {
			nextCursor = &created
		}
	}

	response.OK(w, map[string]interface{}{
		"results": orders,
		"next":    nextCursor,
	})
}

// CancelOrder handles POST /api/orders/cancel/{id}/
func (h *Handler) CancelOrder(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	orderID := chi.URLParam(r, "id")

	var status string
	err := h.db.QueryRow(r.Context(),
		`SELECT status FROM orders_order WHERE id = $1 AND customer_id = $2`, orderID, user.ID).Scan(&status)
	if err == pgx.ErrNoRows {
		response.Error(w, http.StatusNotFound, "Order not found")
		return
	} else if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch order")
		return
	}

	if status != "scheduled" && status != "pending_payment" && status != "paid" {
		response.Error(w, http.StatusBadRequest, "Can only cancel orders with status scheduled, pending_payment, or paid")
		return
	}

	_, err = h.db.Exec(r.Context(),
		`UPDATE orders_order SET status = 'cancelled' WHERE id = $1`, orderID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to cancel order")
		return
	}

	// Record cancellation for fraud detection
	if h.fraud != nil {
		h.fraud.RecordCancel(r.Context(), user.ID)
	}

	// Publish status change
	ctx := context.Background()
	h.pub.PublishOrderStatus(ctx, orderID, "cancelled")

	response.OK(w, map[string]string{"status": "cancelled"})
}

// AllOrders handles GET /api/orders/all/orders/ (public)
func (h *Handler) AllOrders(w http.ResponseWriter, r *http.Request) {
	cursor := r.URL.Query().Get("cursor")
	limit := 50

	var rows pgx.Rows
	var err error

	if cursor != "" {
		cursorTime, _ := time.Parse(time.RFC3339Nano, cursor)
		rows, err = h.db.Query(r.Context(),
			`SELECT id, status, method, customer_id, driver_id, restaurant_id,
				total_fee, tip, delivery_fee, each_item_price,
				restaurant_lat, restaurant_lng, delivery_lat, delivery_lng, delivery_address,
				driver_name, driver_phone, driver_vehicle, restaurant_names,
				external_order_numbers, scheduled_for, created, delivery_out_time, delivery_complete_time,
				preparing_started_at, delivery_photo, tumago_delivery_id
				FROM orders_order WHERE created < $1 ORDER BY created DESC LIMIT $2`,
			cursorTime, limit+1)
	} else {
		rows, err = h.db.Query(r.Context(),
			`SELECT id, status, method, customer_id, driver_id, restaurant_id,
				total_fee, tip, delivery_fee, each_item_price,
				restaurant_lat, restaurant_lng, delivery_lat, delivery_lng, delivery_address,
				driver_name, driver_phone, driver_vehicle, restaurant_names,
				external_order_numbers, scheduled_for, created, delivery_out_time, delivery_complete_time,
				preparing_started_at, delivery_photo, tumago_delivery_id
				FROM orders_order ORDER BY created DESC LIMIT $1`, limit+1)
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch orders")
		return
	}
	defer rows.Close()

	orders := h.scanOrders(rows)

	var nextCursor *string
	if len(orders) > limit {
		orders = orders[:limit]
		if created, ok := orders[limit-1]["created"].(string); ok {
			nextCursor = &created
		}
	}

	response.OK(w, map[string]interface{}{
		"results": orders,
		"next":    nextCursor,
	})
}

// GetOrder handles GET /api/orders/order/{id}/ (public)
func (h *Handler) GetOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")
	order := h.fetchOrder(r.Context(), orderID)
	if order == nil {
		response.Error(w, http.StatusNotFound, "Order not found")
		return
	}
	response.OK(w, order)
}

// AssignDriver handles POST /api/orders/order/{id}/assign-driver/ (public, from realtime service)
func (h *Handler) AssignDriver(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")

	var body struct {
		DriverID      string                 `json:"driver_id"`
		DriverName    string                 `json:"driver_name"`
		DriverPhone   string                 `json:"driver_phone"`
		DriverVehicle map[string]interface{} `json:"driver_vehicle"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	vehicleJSON, err := json.Marshal(body.DriverVehicle)
	if err != nil {
		log.Printf("[order] failed to marshal driver_vehicle: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to process vehicle data")
		return
	}

	// Use SELECT FOR UPDATE to prevent double assignment
	tx, err := h.db.Begin(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Transaction failed")
		return
	}
	defer tx.Rollback(r.Context())

	var currentDriverID *string
	var currentStatus string
	err = tx.QueryRow(r.Context(),
		`SELECT driver_id, status FROM orders_order WHERE id = $1 FOR UPDATE`, orderID).
		Scan(&currentDriverID, &currentStatus)
	if err == pgx.ErrNoRows {
		response.Error(w, http.StatusNotFound, "Order not found")
		return
	} else if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch order")
		return
	}

	if currentDriverID != nil && *currentDriverID != "" {
		response.Error(w, http.StatusConflict, "Driver already assigned to this order")
		return
	}

	_, err = tx.Exec(r.Context(),
		`UPDATE orders_order SET driver_id = $1, driver_name = $2, driver_phone = $3,
		 driver_vehicle = $4, status = 'assigned' WHERE id = $5`,
		body.DriverID, body.DriverName, body.DriverPhone, string(vehicleJSON), orderID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to assign driver")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to commit")
		return
	}

	h.pub.PublishOrderStatus(r.Context(), orderID, "assigned")

	response.OK(w, map[string]interface{}{
		"status":    "assigned",
		"driver_id": body.DriverID,
		"order_id":  orderID,
	})
}

// UpdateStatus handles PATCH /api/orders/order/{id}/status/ (public, from other services)
func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")

	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	validStatuses := map[string]bool{
		"pending_payment": true, "assigned": true, "out_for_delivery": true, "delivered": true,
		"cancelled": true, "preparing": true, "ready": true,
		"awaiting_driver": true, "paid": true, "scheduled": true,
	}
	if !validStatuses[body.Status] {
		response.Error(w, http.StatusBadRequest, "Invalid status: "+body.Status)
		return
	}

	// Fetch current status and validate transition
	var currentStatus string
	err := h.db.QueryRow(r.Context(),
		`SELECT status FROM orders_order WHERE id = $1`, orderID).Scan(&currentStatus)
	if err == pgx.ErrNoRows {
		response.Error(w, http.StatusNotFound, "Order not found")
		return
	} else if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch order")
		return
	}

	// When status is set to "ready" for a delivery order, automatically trigger
	// TumaGo delivery request and transition to "awaiting_driver" instead.
	if body.Status == "ready" && currentStatus == "preparing" {
		if err := h.requestTumaGoDelivery(r.Context(), orderID); err != nil {
			log.Printf("[order] TumaGo delivery request failed for order %s: %v", orderID, err)
			// Still mark as "ready" so the restaurant knows, but log the error.
			// The admin can manually retry or override later.
		} else {
			// TumaGo request succeeded — the order was already transitioned to
			// "awaiting_driver" inside requestTumaGoDelivery, so return early.
			response.OK(w, map[string]interface{}{
				"order_id": orderID,
				"status":   "awaiting_driver",
			})
			return
		}
	}

	if !isValidTransition(currentStatus, body.Status) {
		response.Error(w, http.StatusBadRequest,
			fmt.Sprintf("Cannot transition from '%s' to '%s'", currentStatus, body.Status))
		return
	}

	// Set timestamp fields based on status
	var extraSet string
	switch body.Status {
	case "preparing":
		extraSet = ", preparing_started_at = NOW()"
	case "out_for_delivery":
		extraSet = ", delivery_out_time = NOW()"
	case "delivered":
		extraSet = ", delivery_complete_time = NOW()"
	}

	result, err := h.db.Exec(r.Context(),
		fmt.Sprintf(`UPDATE orders_order SET status = $1%s WHERE id = $2`, extraSet),
		body.Status, orderID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to update status")
		return
	}

	if result.RowsAffected() == 0 {
		response.Error(w, http.StatusNotFound, "Order not found")
		return
	}

	h.pub.PublishOrderStatus(r.Context(), orderID, body.Status)

	response.OK(w, map[string]interface{}{
		"order_id": orderID,
		"status":   body.Status,
	})
}

// UploadDeliveryPhoto handles POST /api/orders/order/{id}/delivery-photo/
// Accepts a multipart form with an image file as proof of delivery.
func (h *Handler) UploadDeliveryPhoto(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")

	// Limit upload size to 10MB
	r.Body = http.MaxBytesReader(w, r.Body, 10<<20)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		response.Error(w, http.StatusBadRequest, "File too large (max 10MB)")
		return
	}

	file, header, err := r.FormFile("photo")
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Photo file is required (field: photo)")
		return
	}
	defer file.Close()

	// Validate order exists and is in a valid status
	var currentStatus string
	err = h.db.QueryRow(r.Context(),
		`SELECT status FROM orders_order WHERE id = $1`, orderID).Scan(&currentStatus)
	if err == pgx.ErrNoRows {
		response.Error(w, http.StatusNotFound, "Order not found")
		return
	}
	if currentStatus != "out_for_delivery" && currentStatus != "delivered" && currentStatus != "assigned" {
		response.Error(w, http.StatusBadRequest, "Order must be in delivery status to upload proof photo")
		return
	}

	// Save file to media directory
	mediaDir := os.Getenv("MEDIA_ROOT")
	if mediaDir == "" {
		mediaDir = "/app/media"
	}
	photoDir := filepath.Join(mediaDir, "delivery_photos")
	os.MkdirAll(photoDir, 0755)

	ext := filepath.Ext(header.Filename)
	if ext == "" {
		ext = ".jpg"
	}
	filename := orderID + ext
	filePath := filepath.Join(photoDir, filename)

	dst, err := os.Create(filePath)
	if err != nil {
		log.Printf("[order] create file error: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to save photo")
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, file); err != nil {
		log.Printf("[order] copy file error: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to save photo")
		return
	}

	// Update order with photo path
	photoURL := "/media/delivery_photos/" + filename
	_, err = h.db.Exec(r.Context(),
		`UPDATE orders_order SET delivery_photo = $1, delivery_photo_at = NOW() WHERE id = $2`,
		photoURL, orderID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to update order with photo")
		return
	}

	response.OK(w, map[string]interface{}{
		"order_id":  orderID,
		"photo_url": photoURL,
		"status":    "uploaded",
	})
}

// GetDeliveryPhoto handles GET /api/orders/order/{id}/delivery-photo/
func (h *Handler) GetDeliveryPhoto(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")

	var photo *string
	err := h.db.QueryRow(r.Context(),
		`SELECT delivery_photo FROM orders_order WHERE id = $1`, orderID).Scan(&photo)
	if err == pgx.ErrNoRows {
		response.Error(w, http.StatusNotFound, "Order not found")
		return
	}
	if photo == nil || *photo == "" {
		response.Error(w, http.StatusNotFound, "No delivery photo for this order")
		return
	}

	response.OK(w, map[string]interface{}{
		"order_id":  orderID,
		"photo_url": *photo,
	})
}

// RestaurantAOV handles GET /api/orders/restaurant/aov/
// Returns the average order value for the authenticated restaurant today.
func (h *Handler) RestaurantAOV(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var avgValue float64
	var orderCount int
	var totalRevenue float64

	h.db.QueryRow(r.Context(),
		`SELECT COALESCE(AVG(total_fee), 0), COALESCE(COUNT(*), 0), COALESCE(SUM(total_fee), 0)
		 FROM orders_order
		 WHERE restaurant_id = $1
		   AND created >= CURRENT_DATE
		   AND status NOT IN ('cancelled', 'pending_payment', 'scheduled')`,
		user.ID).Scan(&avgValue, &orderCount, &totalRevenue)

	response.OK(w, map[string]interface{}{
		"average_order_value": avgValue,
		"order_count":        orderCount,
		"total_revenue":      totalRevenue,
	})
}

// requestTumaGoDelivery fetches the order details, calls TumaGo's Partner API
// to request a delivery, stores the returned tumago_delivery_id, and transitions
// the order to "awaiting_driver".
func (h *Handler) requestTumaGoDelivery(ctx context.Context, orderID string) error {
	// Fetch the fields we need to build the TumaGo delivery request
	var (
		restaurantLat, restaurantLng *float64
		deliveryLat, deliveryLng     *float64
		deliveryFee                  float64
		restaurantNames              *string
		method                       string
	)
	err := h.db.QueryRow(ctx,
		`SELECT restaurant_lat, restaurant_lng, delivery_lat, delivery_lng,
		        delivery_fee, restaurant_names, method
		 FROM orders_order WHERE id = $1`, orderID).
		Scan(&restaurantLat, &restaurantLng, &deliveryLat, &deliveryLng,
			&deliveryFee, &restaurantNames, &method)
	if err != nil {
		return fmt.Errorf("fetch order data: %w", err)
	}

	// Only request a TumaGo delivery for delivery orders (not pickup)
	if method != "delivery" {
		return fmt.Errorf("order %s is method=%s, not delivery", orderID, method)
	}

	// Ensure we have coordinates
	if restaurantLat == nil || restaurantLng == nil || deliveryLat == nil || deliveryLng == nil {
		return fmt.Errorf("order %s missing coordinates", orderID)
	}

	// Build the package description from restaurant name
	pkgDesc := "ZimFeast food delivery"
	if restaurantNames != nil && *restaurantNames != "" {
		pkgDesc = "ZimFeast order from " + *restaurantNames
	}

	req := tumago.DeliveryRequest{
		OriginLat:          *restaurantLat,
		OriginLng:          *restaurantLng,
		DestinationLat:     *deliveryLat,
		DestinationLng:     *deliveryLng,
		Vehicle:            "motorcycle",
		Fare:               deliveryFee,
		PartnerReference:   orderID,
		PickupContact:      "", // restaurant contact could be added later
		DropoffContact:     "", // customer contact could be added later
		PackageDescription: pkgDesc,
	}

	resp, err := h.tumago.RequestDelivery(req)
	if err != nil {
		return fmt.Errorf("tumago API call: %w", err)
	}

	log.Printf("[order] TumaGo delivery requested for order %s → tumago_id=%s", orderID, resp.ID)

	// Store the tumago_delivery_id and transition to awaiting_driver
	_, err = h.db.Exec(ctx,
		`UPDATE orders_order SET status = 'awaiting_driver', tumago_delivery_id = $1 WHERE id = $2`,
		resp.ID, orderID)
	if err != nil {
		return fmt.Errorf("update order with tumago_delivery_id: %w", err)
	}

	h.pub.PublishOrderStatus(ctx, orderID, "awaiting_driver")
	return nil
}

// ──── Helpers ────

func (h *Handler) fetchOrder(ctx context.Context, orderID string) map[string]interface{} {
	var (
		id, status, method                       string
		customerID, restaurantID                  string
		driverID                                  *string
		totalFee, tip, deliveryFee                float64
		eachItemPrice                             *string
		restaurantLat, restaurantLng              *float64
		deliveryLat, deliveryLng                  *float64
		deliveryAddress                           *string
		driverName, driverPhone, driverVehicle    *string
		restaurantNames                           *string
		externalOrderNumbers                      *string
		scheduledFor                              *time.Time
		created                                   time.Time
		deliveryOutTime, deliveryCompleteTime     *time.Time
		preparingStartedAt                        *time.Time
		deliveryPhoto                             *string
		tumagoDeliveryID                          *string
	)

	err := h.db.QueryRow(ctx,
		`SELECT id, status, method, customer_id, driver_id, restaurant_id,
			total_fee, tip, delivery_fee, each_item_price,
			restaurant_lat, restaurant_lng, delivery_lat, delivery_lng, delivery_address,
			driver_name, driver_phone, driver_vehicle, restaurant_names,
			external_order_numbers, scheduled_for, created, delivery_out_time, delivery_complete_time,
			preparing_started_at, delivery_photo, tumago_delivery_id
			FROM orders_order WHERE id = $1`, orderID).
		Scan(&id, &status, &method, &customerID, &driverID, &restaurantID,
			&totalFee, &tip, &deliveryFee, &eachItemPrice,
			&restaurantLat, &restaurantLng, &deliveryLat, &deliveryLng, &deliveryAddress,
			&driverName, &driverPhone, &driverVehicle, &restaurantNames,
			&externalOrderNumbers, &scheduledFor, &created, &deliveryOutTime, &deliveryCompleteTime,
			&preparingStartedAt, &deliveryPhoto, &tumagoDeliveryID)
	if err != nil {
		return nil
	}

	order := map[string]interface{}{
		"id":            id,
		"status":        status,
		"method":        method,
		"customer_id":   customerID,
		"driver_id":     driverID,
		"restaurant_id": restaurantID,
		"total_fee":     totalFee,
		"tip":           tip,
		"delivery_fee":  deliveryFee,
		"created":       created.Format(time.RFC3339Nano),
	}

	if eachItemPrice != nil {
		var parsed interface{}
		if err := json.Unmarshal([]byte(*eachItemPrice), &parsed); err != nil {
			log.Printf("[order] failed to parse each_item_price for order %s: %v", id, err)
		}
		order["each_item_price"] = parsed
	}
	if restaurantLat != nil {
		order["restaurant_lat"] = *restaurantLat
	}
	if restaurantLng != nil {
		order["restaurant_lng"] = *restaurantLng
	}
	if deliveryLat != nil {
		order["delivery_lat"] = *deliveryLat
	}
	if deliveryLng != nil {
		order["delivery_lng"] = *deliveryLng
	}
	if deliveryAddress != nil {
		order["delivery_address"] = *deliveryAddress
	}
	if driverName != nil {
		order["driver_name"] = *driverName
	}
	if driverPhone != nil {
		order["driver_phone"] = *driverPhone
	}
	if driverVehicle != nil {
		var parsed interface{}
		if err := json.Unmarshal([]byte(*driverVehicle), &parsed); err != nil {
			log.Printf("[order] failed to parse driver_vehicle for order %s: %v", id, err)
		}
		order["driver_vehicle"] = parsed
	}
	if restaurantNames != nil {
		order["restaurant_names"] = *restaurantNames
	}
	if externalOrderNumbers != nil {
		var parsed interface{}
		if err := json.Unmarshal([]byte(*externalOrderNumbers), &parsed); err != nil {
			log.Printf("[order] failed to parse external_order_numbers for order %s: %v", id, err)
		}
		order["external_order_numbers"] = parsed
	}
	if scheduledFor != nil {
		order["scheduled_for"] = scheduledFor.Format(time.RFC3339)
	}
	if deliveryOutTime != nil {
		order["delivery_out_time"] = deliveryOutTime.Format(time.RFC3339)
	}
	if deliveryCompleteTime != nil {
		order["delivery_complete_time"] = deliveryCompleteTime.Format(time.RFC3339)
	}
	if preparingStartedAt != nil {
		order["preparing_started_at"] = preparingStartedAt.Format(time.RFC3339)
	}
	if deliveryPhoto != nil {
		order["delivery_photo"] = *deliveryPhoto
	}
	if tumagoDeliveryID != nil {
		order["tumago_delivery_id"] = *tumagoDeliveryID
	}

	// Fetch items
	itemRows, err := h.db.Query(ctx,
		`SELECT id, menu_item_id, menu_item_name, menu_item_price, quantity
		 FROM orders_orderitem WHERE order_id = $1`, orderID)
	if err == nil {
		defer itemRows.Close()
		var items []map[string]interface{}
		for itemRows.Next() {
			var itemID, menuItemID string
			var menuItemName string
			var menuItemPrice float64
			var quantity int
			if err := itemRows.Scan(&itemID, &menuItemID, &menuItemName, &menuItemPrice, &quantity); err != nil {
				continue
			}
			items = append(items, map[string]interface{}{
				"id":              itemID,
				"menu_item_id":    menuItemID,
				"menu_item_name":  menuItemName,
				"menu_item_price": menuItemPrice,
				"quantity":        quantity,
				"price":           menuItemPrice * float64(quantity),
			})
		}
		if items == nil {
			items = []map[string]interface{}{}
		}
		order["items"] = items
	}

	return order
}

func (h *Handler) scanOrders(rows pgx.Rows) []map[string]interface{} {
	var orders []map[string]interface{}
	for rows.Next() {
		var (
			id, status, method                       string
			customerID, restaurantID                  string
			driverID                                  *string
			totalFee, tip, deliveryFee                float64
			eachItemPrice                             *string
			restaurantLat, restaurantLng              *float64
			deliveryLat, deliveryLng                  *float64
			deliveryAddress                           *string
			driverName, driverPhone, driverVehicle    *string
			restaurantNames                           *string
			externalOrderNumbers                      *string
			scheduledFor                              *time.Time
			created                                   time.Time
			deliveryOutTime, deliveryCompleteTime     *time.Time
			preparingStartedAt                        *time.Time
			deliveryPhoto                             *string
			tumagoDeliveryID                          *string
		)

		if err := rows.Scan(&id, &status, &method, &customerID, &driverID, &restaurantID,
			&totalFee, &tip, &deliveryFee, &eachItemPrice,
			&restaurantLat, &restaurantLng, &deliveryLat, &deliveryLng, &deliveryAddress,
			&driverName, &driverPhone, &driverVehicle, &restaurantNames,
			&externalOrderNumbers, &scheduledFor, &created, &deliveryOutTime, &deliveryCompleteTime,
			&preparingStartedAt, &deliveryPhoto, &tumagoDeliveryID); err != nil {
			log.Printf("[order] scan error: %v", err)
			continue
		}

		order := map[string]interface{}{
			"id":            id,
			"status":        status,
			"method":        method,
			"customer_id":   customerID,
			"driver_id":     driverID,
			"restaurant_id": restaurantID,
			"total_fee":     totalFee,
			"tip":           tip,
			"delivery_fee":  deliveryFee,
			"created":       created.Format(time.RFC3339Nano),
		}

		if eachItemPrice != nil {
			var parsed interface{}
			if err := json.Unmarshal([]byte(*eachItemPrice), &parsed); err != nil {
				log.Printf("[order] failed to parse each_item_price for order %s: %v", id, err)
			}
			order["each_item_price"] = parsed
		}
		if restaurantLat != nil {
			order["restaurant_lat"] = *restaurantLat
		}
		if restaurantLng != nil {
			order["restaurant_lng"] = *restaurantLng
		}
		if deliveryLat != nil {
			order["delivery_lat"] = *deliveryLat
		}
		if deliveryLng != nil {
			order["delivery_lng"] = *deliveryLng
		}
		if deliveryAddress != nil {
			order["delivery_address"] = *deliveryAddress
		}
		if driverName != nil {
			order["driver_name"] = *driverName
		}
		if driverPhone != nil {
			order["driver_phone"] = *driverPhone
		}
		if driverVehicle != nil {
			var parsed interface{}
			if err := json.Unmarshal([]byte(*driverVehicle), &parsed); err != nil {
				log.Printf("[order] failed to parse driver_vehicle for order %s: %v", id, err)
			}
			order["driver_vehicle"] = parsed
		}
		if restaurantNames != nil {
			order["restaurant_names"] = *restaurantNames
		}
		if scheduledFor != nil {
			order["scheduled_for"] = scheduledFor.Format(time.RFC3339)
		}
		if deliveryOutTime != nil {
			order["delivery_out_time"] = deliveryOutTime.Format(time.RFC3339)
		}
		if deliveryCompleteTime != nil {
			order["delivery_complete_time"] = deliveryCompleteTime.Format(time.RFC3339)
		}
		if preparingStartedAt != nil {
			order["preparing_started_at"] = preparingStartedAt.Format(time.RFC3339)
		}
		if deliveryPhoto != nil {
			order["delivery_photo"] = *deliveryPhoto
		}
		if tumagoDeliveryID != nil {
			order["tumago_delivery_id"] = *tumagoDeliveryID
		}

		orders = append(orders, order)
	}

	if orders == nil {
		orders = []map[string]interface{}{}
	}
	return orders
}
