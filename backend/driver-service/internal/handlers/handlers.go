package handlers

import (
	"encoding/json"
	"fmt"
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

	// Check approval status before allowing online toggle
	var approvalStatus string
	err := h.db.QueryRow(r.Context(),
		`SELECT COALESCE(approval_status, 'pending') FROM drivers_driver WHERE user_id = $1`, user.ID).Scan(&approvalStatus)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Driver profile not found")
		return
	}
	if approvalStatus != "approved" {
		response.Error(w, http.StatusForbidden, "Your account is not yet approved. Please wait for admin approval.")
		return
	}

	var isOnline bool
	err = h.db.QueryRow(r.Context(),
		`UPDATE drivers_driver SET is_online = NOT is_online, updated_at = NOW()
		 WHERE user_id = $1 RETURNING is_online`, user.ID).Scan(&isOnline)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Driver profile not found")
		return
	}

	response.OK(w, map[string]interface{}{"is_online": isOnline})
}

// GetProfile returns the driver's profile including approval status.
// GET /api/drivers/profile/
func (h *Handler) GetProfile(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	var (
		id             uuid.UUID
		licenseNumber  string
		vehicleDetails *string
		isOnline       bool
		lat, lng       *float64
		approvalStatus string
		approvalNotes  *string
		createdAt      time.Time
	)
	err := h.db.QueryRow(r.Context(),
		`SELECT id, license_number, vehicle_details, is_online, lat, lng,
			COALESCE(approval_status, 'pending'), approval_notes, created_at
		 FROM drivers_driver WHERE user_id = $1`, user.ID).
		Scan(&id, &licenseNumber, &vehicleDetails, &isOnline, &lat, &lng,
			&approvalStatus, &approvalNotes, &createdAt)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Driver profile not found")
		return
	}

	profile := map[string]interface{}{
		"id":              id.String(),
		"user_id":         user.ID,
		"license_number":  licenseNumber,
		"is_online":       isOnline,
		"approval_status": approvalStatus,
		"created_at":      createdAt.Format(time.RFC3339),
	}
	if vehicleDetails != nil {
		var parsed interface{}
		if err := json.Unmarshal([]byte(*vehicleDetails), &parsed); err == nil {
			profile["vehicle_details"] = parsed
		}
	}
	if lat != nil {
		profile["lat"] = *lat
	}
	if lng != nil {
		profile["lng"] = *lng
	}
	if approvalNotes != nil {
		profile["approval_notes"] = *approvalNotes
	}

	response.OK(w, profile)
}

// AdminPendingDrivers handles GET /api/drivers/admin/pending/
func (h *Handler) AdminPendingDrivers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	page := parseIntParam(r, "page", 1)
	pageSize := parseIntParam(r, "page_size", 20)
	offset := (page - 1) * pageSize

	var total int
	h.db.QueryRow(ctx, `SELECT COUNT(*) FROM drivers_driver WHERE COALESCE(approval_status, 'pending') = 'pending'`).Scan(&total)

	rows, err := h.db.Query(ctx,
		`SELECT id, user_id, license_number, vehicle_details, lat, lng, created_at
		 FROM drivers_driver WHERE COALESCE(approval_status, 'pending') = 'pending'
		 ORDER BY created_at DESC LIMIT $1 OFFSET $2`, pageSize, offset)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch pending drivers")
		return
	}
	defer rows.Close()

	var drivers []map[string]interface{}
	for rows.Next() {
		var (
			id, userID     uuid.UUID
			licenseNumber  string
			vehicleDetails *string
			lat, lng       *float64
			createdAt      time.Time
		)
		if err := rows.Scan(&id, &userID, &licenseNumber, &vehicleDetails, &lat, &lng, &createdAt); err != nil {
			continue
		}
		entry := map[string]interface{}{
			"id":             id.String(),
			"user_id":        userID.String(),
			"license_number": licenseNumber,
			"created_at":     createdAt.Format(time.RFC3339),
		}
		if vehicleDetails != nil {
			var parsed interface{}
			if err := json.Unmarshal([]byte(*vehicleDetails), &parsed); err == nil {
				entry["vehicle_details"] = parsed
			}
		}
		if lat != nil {
			entry["lat"] = *lat
		}
		if lng != nil {
			entry["lng"] = *lng
		}
		drivers = append(drivers, entry)
	}
	if drivers == nil {
		drivers = []map[string]interface{}{}
	}

	response.OK(w, map[string]interface{}{
		"results":   drivers,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// AdminApproveDriver handles POST /api/drivers/admin/{id}/approve/
func (h *Handler) AdminApproveDriver(w http.ResponseWriter, r *http.Request) {
	driverID := chi.URLParam(r, "id")

	_, err := h.db.Exec(r.Context(),
		`UPDATE drivers_driver SET approval_status = 'approved', approved_at = NOW(), updated_at = NOW()
		 WHERE id = $1`, driverID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to approve driver")
		return
	}

	response.OK(w, map[string]interface{}{
		"driver_id": driverID,
		"status":    "approved",
	})
}

// AdminRejectDriver handles POST /api/drivers/admin/{id}/reject/
func (h *Handler) AdminRejectDriver(w http.ResponseWriter, r *http.Request) {
	driverID := chi.URLParam(r, "id")

	var body struct {
		Notes string `json:"notes"`
	}
	json.NewDecoder(r.Body).Decode(&body)

	_, err := h.db.Exec(r.Context(),
		`UPDATE drivers_driver SET approval_status = 'rejected', approval_notes = $1, updated_at = NOW()
		 WHERE id = $2`, body.Notes, driverID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to reject driver")
		return
	}

	response.OK(w, map[string]interface{}{
		"driver_id": driverID,
		"status":    "rejected",
		"notes":     body.Notes,
	})
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

// GetRecentRatings returns the most recent rating comments received by the
// authenticated driver. Used by the driver app to display a "Recent Reviews"
// section in the earnings tab.
// GET /api/drivers/ratings/recent/?limit=10
func (h *Handler) GetRecentRatings(w http.ResponseWriter, r *http.Request) {
	user := auth.UserFromContext(r.Context())
	if user == nil {
		response.Error(w, http.StatusUnauthorized, "Authentication required")
		return
	}

	limit := parseIntParam(r, "limit", 10)
	if limit > 50 {
		limit = 50
	}

	rows, err := h.db.Query(r.Context(),
		`SELECT id, rating, comment, created_at
		 FROM drivers_driverrating
		 WHERE driver_id = $1
		 ORDER BY created_at DESC
		 LIMIT $2`, user.ID, limit)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to fetch ratings")
		return
	}
	defer rows.Close()

	type ratingEntry struct {
		ID        string  `json:"id"`
		Rating    float64 `json:"rating"`
		Comment   string  `json:"comment"`
		CreatedAt string  `json:"created_at"`
	}

	ratings := []ratingEntry{}
	for rows.Next() {
		var entry ratingEntry
		var id uuid.UUID
		var createdAt time.Time
		if err := rows.Scan(&id, &entry.Rating, &entry.Comment, &createdAt); err != nil {
			continue
		}
		entry.ID = id.String()
		entry.CreatedAt = createdAt.Format(time.RFC3339)
		ratings = append(ratings, entry)
	}

	response.OK(w, map[string]interface{}{
		"ratings": ratings,
		"count":   len(ratings),
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

// ──── Admin Endpoints ────

// AdminListDrivers handles GET /api/drivers/admin/list/
// Returns all drivers with admin info. Supports filtering by status (online/offline),
// q (search name), page, and page_size query params.
func (h *Handler) AdminListDrivers(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	page := parseIntParam(r, "page", 1)
	if page < 1 {
		page = 1
	}
	pageSize := parseIntParam(r, "page_size", 20)
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	// Build dynamic WHERE clauses
	conditions := []string{}
	args := []interface{}{}
	argIdx := 1

	if statusFilter := q.Get("status"); statusFilter != "" {
		switch statusFilter {
		case "online":
			conditions = append(conditions, "d.is_online = true")
		case "offline":
			conditions = append(conditions, "d.is_online = false")
		}
	}

	if search := q.Get("q"); search != "" {
		// Search by name from auth service is not possible here directly,
		// but the driver table may store info. We search vehicle_details for name-like info.
		// For now, search on user_id or license_number.
		conditions = append(conditions, fmt.Sprintf("(d.license_number ILIKE $%d OR d.user_id::text ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+search+"%")
		argIdx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + joinStrings(conditions, " AND ")
	}

	// Count total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM drivers_driver d %s", whereClause)
	h.db.QueryRow(ctx, countQuery, args...).Scan(&total)

	// Fetch paginated results
	dataQuery := fmt.Sprintf(
		`SELECT d.id, d.user_id, d.license_number, d.vehicle_details,
			d.is_online, d.lat, d.lng, d.created_at,
			COALESCE(SUM(f.today_deliveries), 0) as total_deliveries,
			CASE WHEN COALESCE(SUM(f.rating_count), 0) > 0
				THEN ROUND(CAST(SUM(f.rating_sum) / SUM(f.rating_count) AS numeric), 2)
				ELSE 0 END as avg_rating
		 FROM drivers_driver d
		 LEFT JOIN drivers_driverfinance f ON f.driver_id = d.id
		 %s
		 GROUP BY d.id, d.user_id, d.license_number, d.vehicle_details,
			d.is_online, d.lat, d.lng, d.created_at
		 ORDER BY d.created_at DESC
		 LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)
	args = append(args, pageSize, offset)

	rows, err := h.db.Query(ctx, dataQuery, args...)
	if err != nil {
		log.Printf("[admin] list drivers error: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to list drivers")
		return
	}
	defer rows.Close()

	var drivers []map[string]interface{}
	for rows.Next() {
		var (
			id, userID     uuid.UUID
			licenseNumber  string
			vehicleDetails *string
			isOnline       bool
			lat, lng       *float64
			createdAt      time.Time
			totalDel       int
			avgRating      float64
		)
		if err := rows.Scan(&id, &userID, &licenseNumber, &vehicleDetails,
			&isOnline, &lat, &lng, &createdAt, &totalDel, &avgRating); err != nil {
			log.Printf("[admin] scan driver error: %v", err)
			continue
		}

		entry := map[string]interface{}{
			"id":               id.String(),
			"user_id":          userID.String(),
			"license_number":   licenseNumber,
			"is_online":        isOnline,
			"total_deliveries": totalDel,
			"average_rating":   avgRating,
			"created_at":       createdAt.Format(time.RFC3339),
		}

		if vehicleDetails != nil {
			var parsed interface{}
			if err := json.Unmarshal([]byte(*vehicleDetails), &parsed); err == nil {
				entry["vehicle_details"] = parsed
			}
		}
		if lat != nil {
			entry["lat"] = *lat
		}
		if lng != nil {
			entry["lng"] = *lng
		}

		drivers = append(drivers, entry)
	}

	if drivers == nil {
		drivers = []map[string]interface{}{}
	}

	response.OK(w, map[string]interface{}{
		"results":   drivers,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// AdminDriverDetail handles GET /api/drivers/admin/driver/{id}/detail/
// Returns full driver detail: profile, finance summary, recent orders, and rating.
func (h *Handler) AdminDriverDetail(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	driverID := chi.URLParam(r, "id")

	driverUUID, err := uuid.Parse(driverID)
	if err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid driver ID")
		return
	}

	// Fetch driver profile
	var (
		id, userID     uuid.UUID
		licenseNumber  string
		vehicleDetails *string
		isOnline       bool
		lat, lng       *float64
		createdAt      time.Time
	)
	err = h.db.QueryRow(ctx,
		`SELECT id, user_id, license_number, vehicle_details, is_online, lat, lng, created_at
		 FROM drivers_driver WHERE id = $1`, driverUUID).
		Scan(&id, &userID, &licenseNumber, &vehicleDetails, &isOnline, &lat, &lng, &createdAt)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Driver not found")
		return
	}

	profile := map[string]interface{}{
		"id":             id.String(),
		"user_id":        userID.String(),
		"license_number": licenseNumber,
		"is_online":      isOnline,
		"created_at":     createdAt.Format(time.RFC3339),
	}
	if vehicleDetails != nil {
		var parsed interface{}
		if err := json.Unmarshal([]byte(*vehicleDetails), &parsed); err == nil {
			profile["vehicle_details"] = parsed
		}
	}
	if lat != nil {
		profile["lat"] = *lat
	}
	if lng != nil {
		profile["lng"] = *lng
	}

	// Finance summary (aggregate all days)
	var totalDeliveries int
	var totalEarnings, totalHours float64
	var avgRating float64
	h.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(today_deliveries), 0),
			COALESCE(SUM(today_earnings), 0),
			COALESCE(SUM(hours_online), 0),
			CASE WHEN COALESCE(SUM(rating_count), 0) > 0
				THEN ROUND(CAST(SUM(rating_sum) / SUM(rating_count) AS numeric), 2)
				ELSE 0 END
		 FROM drivers_driverfinance WHERE driver_id = $1`, driverUUID).
		Scan(&totalDeliveries, &totalEarnings, &totalHours, &avgRating)

	finance := map[string]interface{}{
		"total_deliveries": totalDeliveries,
		"total_earnings":   totalEarnings,
		"total_hours":      totalHours,
		"average_rating":   avgRating,
	}

	// Recent orders (last 10)
	orderRows, err := h.db.Query(ctx,
		`SELECT id, order_id, status, assigned_at, completed_at
		 FROM drivers_driverorderstatus
		 WHERE driver_id = $1
		 ORDER BY assigned_at DESC LIMIT 10`, driverUUID)
	var recentOrders []map[string]interface{}
	if err == nil {
		defer orderRows.Close()
		for orderRows.Next() {
			var oid, orderID uuid.UUID
			var orderStatus string
			var assignedAt time.Time
			var completedAt *time.Time
			if err := orderRows.Scan(&oid, &orderID, &orderStatus, &assignedAt, &completedAt); err != nil {
				continue
			}
			entry := map[string]interface{}{
				"id":          oid.String(),
				"order_id":    orderID.String(),
				"status":      orderStatus,
				"assigned_at": assignedAt.Format(time.RFC3339),
			}
			if completedAt != nil {
				entry["completed_at"] = completedAt.Format(time.RFC3339)
			}
			recentOrders = append(recentOrders, entry)
		}
	}
	if recentOrders == nil {
		recentOrders = []map[string]interface{}{}
	}

	// Recent ratings (last 5)
	ratingRows, err := h.db.Query(ctx,
		`SELECT id, rating, comment, created_at
		 FROM drivers_driverrating
		 WHERE driver_id = $1
		 ORDER BY created_at DESC LIMIT 5`, driverUUID)
	var recentRatings []map[string]interface{}
	if err == nil {
		defer ratingRows.Close()
		for ratingRows.Next() {
			var rid uuid.UUID
			var rating float64
			var comment string
			var rCreatedAt time.Time
			if err := ratingRows.Scan(&rid, &rating, &comment, &rCreatedAt); err != nil {
				continue
			}
			recentRatings = append(recentRatings, map[string]interface{}{
				"id":         rid.String(),
				"rating":     rating,
				"comment":    comment,
				"created_at": rCreatedAt.Format(time.RFC3339),
			})
		}
	}
	if recentRatings == nil {
		recentRatings = []map[string]interface{}{}
	}

	response.OK(w, map[string]interface{}{
		"profile":        profile,
		"finance":        finance,
		"recent_orders":  recentOrders,
		"recent_ratings": recentRatings,
	})
}

// AdminHealthCheck handles GET /api/drivers/health/ (enhanced)
// Returns service health including DB connection status and Redis ping.
func (h *Handler) AdminHealthCheck(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	dbStatus := "ok"
	if err := h.db.Ping(ctx); err != nil {
		dbStatus = fmt.Sprintf("error: %v", err)
	}

	redisStatus := "ok"
	if err := h.pub.Client().Ping(ctx).Err(); err != nil {
		redisStatus = fmt.Sprintf("error: %v", err)
	}

	overallStatus := "ok"
	if dbStatus != "ok" || redisStatus != "ok" {
		overallStatus = "degraded"
	}

	response.OK(w, map[string]interface{}{
		"status":    overallStatus,
		"service":   "driver-service",
		"database":  dbStatus,
		"redis":     redisStatus,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}

// joinStrings joins string slices with a separator (avoids importing strings package).
func joinStrings(parts []string, sep string) string {
	result := ""
	for i, p := range parts {
		if i > 0 {
			result += sep
		}
		result += p
	}
	return result
}
