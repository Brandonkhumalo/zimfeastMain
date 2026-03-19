package handlers

import (
	"encoding/json"
	"log"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"zimfeast/shared/auth"
	"zimfeast/shared/config"
	"zimfeast/shared/redispub"
	"zimfeast/shared/response"
)

type Handler struct {
	db  *pgxpool.Pool
	pub *redispub.Publisher
	cfg *config.Config
}

func New(db *pgxpool.Pool, pub *redispub.Publisher, cfg *config.Config) *Handler {
	return &Handler{db: db, pub: pub, cfg: cfg}
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	response.OK(w, map[string]string{"status": "ok"})
}

func (h *Handler) CreateProfile(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var body struct {
		LicenseNumber string                 `json:"license_number"`
		VehicleDetails map[string]interface{} `json:"vehicle_details"`
		Address       string                 `json:"address"`
		Lat           *float64               `json:"lat"`
		Lng           *float64               `json:"lng"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	id := uuid.New()
	vehicleJSON, _ := json.Marshal(body.VehicleDetails)

	var lat, lng *float64
	lat = body.Lat
	lng = body.Lng

	_, err := h.db.Exec(r.Context(),
		`INSERT INTO drivers_driver (id, user_id, license_number, vehicle_details, lat, lng, is_online, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, false, NOW(), NOW())`,
		id, user.ID, body.LicenseNumber, string(vehicleJSON), lat, lng)
	if err != nil {
		log.Printf("[handler] create profile error: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to create profile")
		return
	}

	response.Created(w, map[string]interface{}{
		"id":              id.String(),
		"user_id":         user.ID,
		"license_number":  body.LicenseNumber,
		"vehicle_details": body.VehicleDetails,
		"is_online":       false,
		"lat":             lat,
		"lng":             lng,
	})
}

func (h *Handler) ToggleStatus(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var isOnline bool
	err := h.db.QueryRow(r.Context(),
		`UPDATE drivers_driver SET is_online = NOT is_online, updated_at = NOW()
		 WHERE user_id = $1 RETURNING is_online`, user.ID).Scan(&isOnline)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Driver profile not found")
		return
	}

	response.OK(w, map[string]interface{}{"is_online": isOnline})
}

func (h *Handler) GetStatus(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var isOnline bool
	err := h.db.QueryRow(r.Context(),
		`SELECT is_online FROM drivers_driver WHERE user_id = $1`, user.ID).Scan(&isOnline)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Driver profile not found")
		return
	}

	response.OK(w, map[string]interface{}{"is_online": isOnline})
}

func (h *Handler) UpdateLocation(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var body struct {
		Lat float64 `json:"lat"`
		Lng float64 `json:"lng"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	_, err := h.db.Exec(r.Context(),
		`UPDATE drivers_driver SET lat = $1, lng = $2, updated_at = NOW() WHERE user_id = $3`,
		body.Lat, body.Lng, user.ID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to update location")
		return
	}

	response.OK(w, map[string]interface{}{"lat": body.Lat, "lng": body.Lng})
}

func (h *Handler) RejectOrder(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	orderID := chi.URLParam(r, "pk")
	var body struct {
		Reason string `json:"reason"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	// Get driver ID
	var driverID uuid.UUID
	err := h.db.QueryRow(r.Context(),
		`SELECT id FROM drivers_driver WHERE user_id = $1`, user.ID).Scan(&driverID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Driver profile not found")
		return
	}

	_, err = h.db.Exec(r.Context(),
		`INSERT INTO drivers_driverreject (id, driver_id, order_id, reason, rejected_at)
		 VALUES ($1, $2, $3, $4, NOW())`,
		uuid.New(), driverID, orderID, body.Reason)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to record rejection")
		return
	}

	response.OK(w, map[string]string{"status": "rejected"})
}

func (h *Handler) CancelOrder(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	orderID := chi.URLParam(r, "orderId")

	var driverID uuid.UUID
	err := h.db.QueryRow(r.Context(),
		`SELECT id FROM drivers_driver WHERE user_id = $1`, user.ID).Scan(&driverID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Driver profile not found")
		return
	}

	_, err = h.db.Exec(r.Context(),
		`UPDATE drivers_driverorderstatus SET status = 'cancelled', completed_at = NOW()
		 WHERE driver_id = $1 AND order_id = $2 AND status IN ('pending', 'accepted', 'delivering')`,
		driverID, orderID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to cancel order")
		return
	}

	response.OK(w, map[string]string{"status": "cancelled"})
}

func (h *Handler) ActiveOrders(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var driverID uuid.UUID
	err := h.db.QueryRow(r.Context(),
		`SELECT id FROM drivers_driver WHERE user_id = $1`, user.ID).Scan(&driverID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Driver profile not found")
		return
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT id, order_id, status, assigned_at FROM drivers_driverorderstatus
		 WHERE driver_id = $1 AND status IN ('accepted', 'delivering')
		 ORDER BY assigned_at DESC`, driverID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch orders")
		return
	}
	defer rows.Close()

	var orders []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var orderID uuid.UUID
		var status string
		var assignedAt time.Time
		if err := rows.Scan(&id, &orderID, &status, &assignedAt); err != nil {
			continue
		}
		orders = append(orders, map[string]interface{}{
			"id":          id.String(),
			"order_id":    orderID.String(),
			"status":      status,
			"assigned_at": assignedAt.Format(time.RFC3339),
		})
	}

	if orders == nil {
		orders = []map[string]interface{}{}
	}
	response.OK(w, orders)
}

func (h *Handler) OrderHistory(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var driverID uuid.UUID
	err := h.db.QueryRow(r.Context(),
		`SELECT id FROM drivers_driver WHERE user_id = $1`, user.ID).Scan(&driverID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Driver profile not found")
		return
	}

	// Cursor pagination
	limit := 5
	cursor := r.URL.Query().Get("cursor")

	var rows pgx.Rows
	if cursor != "" {
		cursorTime, _ := time.Parse(time.RFC3339, cursor)
		rows, err = h.db.Query(r.Context(),
			`SELECT id, order_id, status, assigned_at, completed_at FROM drivers_driverorderstatus
			 WHERE driver_id = $1 AND status IN ('completed', 'cancelled') AND completed_at < $2
			 ORDER BY completed_at DESC LIMIT $3`, driverID, cursorTime, limit+1)
	} else {
		rows, err = h.db.Query(r.Context(),
			`SELECT id, order_id, status, assigned_at, completed_at FROM drivers_driverorderstatus
			 WHERE driver_id = $1 AND status IN ('completed', 'cancelled')
			 ORDER BY completed_at DESC LIMIT $2`, driverID, limit+1)
	}
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch orders")
		return
	}
	defer rows.Close()

	var orders []map[string]interface{}
	for rows.Next() {
		var id, orderID uuid.UUID
		var status string
		var assignedAt time.Time
		var completedAt *time.Time
		if err := rows.Scan(&id, &orderID, &status, &assignedAt, &completedAt); err != nil {
			continue
		}
		entry := map[string]interface{}{
			"id":          id.String(),
			"order_id":    orderID.String(),
			"status":      status,
			"assigned_at": assignedAt.Format(time.RFC3339),
		}
		if completedAt != nil {
			entry["completed_at"] = completedAt.Format(time.RFC3339)
		}
		orders = append(orders, entry)
	}

	var nextCursor *string
	if len(orders) > limit {
		orders = orders[:limit]
		last := orders[limit-1]
		if ct, ok := last["completed_at"].(string); ok {
			nextCursor = &ct
		}
	}

	if orders == nil {
		orders = []map[string]interface{}{}
	}

	result := map[string]interface{}{
		"results": orders,
		"next":    nextCursor,
	}
	response.OK(w, result)
}

func (h *Handler) GetFinance(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var driverID uuid.UUID
	err := h.db.QueryRow(r.Context(),
		`SELECT id FROM drivers_driver WHERE user_id = $1`, user.ID).Scan(&driverID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Driver profile not found")
		return
	}

	today := time.Now().Format("2006-01-02")

	var id uuid.UUID
	var date string
	var deliveries int
	var earnings, hoursOnline float64
	var ratingSum float64
	var ratingCount int

	err = h.db.QueryRow(r.Context(),
		`SELECT id, date, today_deliveries, today_earnings, hours_online, rating_sum, rating_count
		 FROM drivers_driverfinance WHERE driver_id = $1 AND date = $2`, driverID, today).
		Scan(&id, &date, &deliveries, &earnings, &hoursOnline, &ratingSum, &ratingCount)

	if err == pgx.ErrNoRows {
		// Create a new record for today
		id = uuid.New()
		h.db.Exec(r.Context(),
			`INSERT INTO drivers_driverfinance (id, driver_id, date, today_deliveries, today_earnings, hours_online, rating_sum, rating_count)
			 VALUES ($1, $2, $3, 0, 0, 0, 0, 0)`, id, driverID, today)

		response.OK(w, map[string]interface{}{
			"date": today, "today_deliveries": 0, "today_earnings": 0.0,
			"hours_online": 0.0, "average_rating": 0.0,
		})
		return
	} else if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch finance")
		return
	}

	var avgRating float64
	if ratingCount > 0 {
		avgRating = math.Round((ratingSum/float64(ratingCount))*100) / 100
	}

	response.OK(w, map[string]interface{}{
		"date":             date,
		"today_deliveries": deliveries,
		"today_earnings":   earnings,
		"hours_online":     hoursOnline,
		"average_rating":   avgRating,
	})
}

func (h *Handler) UpdateFinance(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var driverID uuid.UUID
	err := h.db.QueryRow(r.Context(),
		`SELECT id FROM drivers_driver WHERE user_id = $1`, user.ID).Scan(&driverID)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Driver profile not found")
		return
	}

	var body struct {
		Earnings    *float64 `json:"earnings"`
		Deliveries  *int     `json:"deliveries"`
		HoursOnline *float64 `json:"hours_online"`
		Rating      *float64 `json:"rating"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	today := time.Now().Format("2006-01-02")

	// Upsert finance record
	_, err = h.db.Exec(r.Context(),
		`INSERT INTO drivers_driverfinance (id, driver_id, date, today_deliveries, today_earnings, hours_online, rating_sum, rating_count)
		 VALUES ($1, $2, $3, 0, 0, 0, 0, 0)
		 ON CONFLICT (driver_id, date) DO NOTHING`, uuid.New(), driverID, today)
	if err != nil {
		log.Printf("[finance] upsert error: %v", err)
	}

	// Atomic increments using F() equivalent
	if body.Earnings != nil {
		h.db.Exec(r.Context(),
			`UPDATE drivers_driverfinance SET today_earnings = today_earnings + $1
			 WHERE driver_id = $2 AND date = $3`, *body.Earnings, driverID, today)
	}
	if body.Deliveries != nil {
		h.db.Exec(r.Context(),
			`UPDATE drivers_driverfinance SET today_deliveries = today_deliveries + $1
			 WHERE driver_id = $2 AND date = $3`, *body.Deliveries, driverID, today)
	}
	if body.HoursOnline != nil {
		h.db.Exec(r.Context(),
			`UPDATE drivers_driverfinance SET hours_online = hours_online + $1
			 WHERE driver_id = $2 AND date = $3`, *body.HoursOnline, driverID, today)
	}
	if body.Rating != nil {
		h.db.Exec(r.Context(),
			`UPDATE drivers_driverfinance SET rating_sum = rating_sum + $1, rating_count = rating_count + 1
			 WHERE driver_id = $2 AND date = $3`, *body.Rating, driverID, today)
	}

	response.OK(w, map[string]string{"status": "updated"})
}

func (h *Handler) SubmitRating(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var body struct {
		DriverID string  `json:"driver_id"`
		Rating   float64 `json:"rating"`
		Comment  string  `json:"comment"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Rating < 1 || body.Rating > 5 {
		response.Error(w, http.StatusBadRequest, "Rating must be between 1 and 5")
		return
	}

	driverUUID, err := uuid.Parse(body.DriverID)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid driver ID")
		return
	}

	tx, err := h.db.Begin(r.Context())
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Transaction failed")
		return
	}
	defer tx.Rollback(r.Context())

	// Insert rating
	_, err = tx.Exec(r.Context(),
		`INSERT INTO drivers_driverrating (id, driver_id, user_id, rating, comment, created_at)
		 VALUES ($1, $2, $3, $4, $5, NOW())`,
		uuid.New(), driverUUID, user.ID, body.Rating, body.Comment)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to submit rating")
		return
	}

	// Update finance atomically
	today := time.Now().Format("2006-01-02")
	_, err = tx.Exec(r.Context(),
		`INSERT INTO drivers_driverfinance (id, driver_id, date, today_deliveries, today_earnings, hours_online, rating_sum, rating_count)
		 VALUES ($1, $2, $3, 0, 0, 0, $4, 1)
		 ON CONFLICT (driver_id, date)
		 DO UPDATE SET rating_sum = drivers_driverfinance.rating_sum + $4, rating_count = drivers_driverfinance.rating_count + 1`,
		uuid.New(), driverUUID, today, body.Rating)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to update finance")
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to commit")
		return
	}

	response.Created(w, map[string]interface{}{
		"driver_id": body.DriverID,
		"rating":    body.Rating,
		"status":    "submitted",
	})
}

// Helper to parse int from query param
func parseIntParam(r *http.Request, key string, def int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return def
	}
	return n
}
