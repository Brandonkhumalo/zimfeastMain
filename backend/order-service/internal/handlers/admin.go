package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"zimfeast/shared/response"
)

// AdminAnalytics handles GET /api/orders/admin/analytics/
func (h *Handler) AdminAnalytics(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	now := time.Now()
	today := now.Format("2006-01-02")
	last7 := now.AddDate(0, 0, -7).Format("2006-01-02")
	last30 := now.AddDate(0, 0, -30).Format("2006-01-02")

	// Period stats helper
	periodStats := func(since string) map[string]interface{} {
		var count int
		var revenue, avgValue float64

		h.db.QueryRow(ctx,
			`SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(total_fee), 0), COALESCE(AVG(total_fee), 0)
			 FROM orders_order WHERE created >= $1::date`, since).
			Scan(&count, &revenue, &avgValue)

		return map[string]interface{}{
			"order_count":     count,
			"revenue":         revenue,
			"avg_order_value": avgValue,
		}
	}

	// All-time stats
	var totalOrders int
	var totalRevenue float64
	h.db.QueryRow(ctx,
		`SELECT COALESCE(COUNT(*), 0), COALESCE(SUM(total_fee), 0) FROM orders_order`).
		Scan(&totalOrders, &totalRevenue)

	// Status breakdown
	statusRows, _ := h.db.Query(ctx,
		`SELECT status, COUNT(*) FROM orders_order GROUP BY status`)
	statusBreakdown := make(map[string]int)
	if statusRows != nil {
		defer statusRows.Close()
		for statusRows.Next() {
			var s string
			var c int
			statusRows.Scan(&s, &c)
			statusBreakdown[s] = c
		}
	}

	// Method breakdown
	methodRows, _ := h.db.Query(ctx,
		`SELECT method, COUNT(*) FROM orders_order GROUP BY method`)
	methodBreakdown := make(map[string]int)
	if methodRows != nil {
		defer methodRows.Close()
		for methodRows.Next() {
			var m string
			var c int
			methodRows.Scan(&m, &c)
			methodBreakdown[m] = c
		}
	}

	// Top 10 restaurants
	topRestRows, _ := h.db.Query(ctx,
		`SELECT restaurant_id, restaurant_names, COUNT(*) as cnt, COALESCE(SUM(total_fee), 0)
		 FROM orders_order WHERE restaurant_id IS NOT NULL
		 GROUP BY restaurant_id, restaurant_names ORDER BY cnt DESC LIMIT 10`)
	var topRestaurants []map[string]interface{}
	if topRestRows != nil {
		defer topRestRows.Close()
		for topRestRows.Next() {
			var rid, rname string
			var cnt int
			var rev float64
			topRestRows.Scan(&rid, &rname, &cnt, &rev)
			topRestaurants = append(topRestaurants, map[string]interface{}{
				"restaurant_id": rid, "name": rname, "order_count": cnt, "revenue": rev,
			})
		}
	}
	if topRestaurants == nil {
		topRestaurants = []map[string]interface{}{}
	}

	// Recent 20 orders
	recentRows, _ := h.db.Query(ctx,
		`SELECT id, status, method, total_fee, created FROM orders_order ORDER BY created DESC LIMIT 20`)
	var recentOrders []map[string]interface{}
	if recentRows != nil {
		defer recentRows.Close()
		for recentRows.Next() {
			var id, status, method string
			var fee float64
			var created time.Time
			recentRows.Scan(&id, &status, &method, &fee, &created)
			recentOrders = append(recentOrders, map[string]interface{}{
				"id": id, "status": status, "method": method,
				"total_fee": fee, "created": created.Format(time.RFC3339),
			})
		}
	}
	if recentOrders == nil {
		recentOrders = []map[string]interface{}{}
	}

	// Daily revenue (last 30 days)
	dailyRows, _ := h.db.Query(ctx,
		`SELECT DATE(created) as day, COALESCE(SUM(total_fee), 0)
		 FROM orders_order WHERE created >= $1::date
		 GROUP BY day ORDER BY day`, last30)
	var dailyRevenue []map[string]interface{}
	if dailyRows != nil {
		defer dailyRows.Close()
		for dailyRows.Next() {
			var day time.Time
			var rev float64
			dailyRows.Scan(&day, &rev)
			dailyRevenue = append(dailyRevenue, map[string]interface{}{
				"date": day.Format("2006-01-02"), "revenue": rev,
			})
		}
	}
	if dailyRevenue == nil {
		dailyRevenue = []map[string]interface{}{}
	}

	response.OK(w, map[string]interface{}{
		"today":            periodStats(today),
		"last_7_days":      periodStats(last7),
		"last_30_days":     periodStats(last30),
		"all_time":         map[string]interface{}{"total_orders": totalOrders, "total_revenue": totalRevenue},
		"status_breakdown": statusBreakdown,
		"method_breakdown": methodBreakdown,
		"top_restaurants":  topRestaurants,
		"recent_orders":    recentOrders,
		"daily_revenue":    dailyRevenue,
	})
}

// AdminOrderDetail handles GET /api/orders/admin/order/{id}/
func (h *Handler) AdminOrderDetail(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "id")
	order := h.fetchOrder(r.Context(), orderID)
	if order == nil {
		response.Error(w, http.StatusNotFound, "Order not found")
		return
	}
	response.OK(w, order)
}

// AdminSearchOrders handles GET /api/orders/admin/search/
// Supports filtering by status, customer_id, restaurant_id, driver_id,
// date_from, date_to, q (text search on restaurant_names), page, page_size.
func (h *Handler) AdminSearchOrders(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	q := r.URL.Query()

	// Pagination
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(q.Get("page_size"))
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	// Build WHERE clauses dynamically
	// conditions holds SQL fragments; args holds the corresponding $N values
	conditions := []string{}
	args := []interface{}{}
	argIdx := 1

	if v := q.Get("status"); v != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("customer_id"); v != "" {
		conditions = append(conditions, fmt.Sprintf("customer_id = $%d", argIdx))
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("restaurant_id"); v != "" {
		conditions = append(conditions, fmt.Sprintf("restaurant_id = $%d", argIdx))
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("driver_id"); v != "" {
		conditions = append(conditions, fmt.Sprintf("driver_id = $%d", argIdx))
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("date_from"); v != "" {
		conditions = append(conditions, fmt.Sprintf("created >= $%d::date", argIdx))
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("date_to"); v != "" {
		// Add 1 day so date_to is inclusive of the whole day
		conditions = append(conditions, fmt.Sprintf("created < ($%d::date + INTERVAL '1 day')", argIdx))
		args = append(args, v)
		argIdx++
	}
	if v := q.Get("q"); v != "" {
		conditions = append(conditions, fmt.Sprintf("restaurant_names ILIKE $%d", argIdx))
		args = append(args, "%"+v+"%")
		argIdx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Count total matching rows
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM orders_order %s", whereClause)
	var total int
	if err := h.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		log.Printf("[admin] search count error: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to count orders")
		return
	}

	// Fetch paginated results
	dataQuery := fmt.Sprintf(
		`SELECT id, status, method, customer_id, driver_id, restaurant_id,
			total_fee, tip, delivery_fee, each_item_price,
			restaurant_lat, restaurant_lng, delivery_lat, delivery_lng, delivery_address,
			driver_name, driver_phone, driver_vehicle, restaurant_names,
			external_order_numbers, scheduled_for, created, delivery_out_time, delivery_complete_time,
			preparing_started_at, delivery_photo
		 FROM orders_order %s
		 ORDER BY created DESC
		 LIMIT $%d OFFSET $%d`,
		whereClause, argIdx, argIdx+1)
	args = append(args, pageSize, offset)

	rows, err := h.db.Query(ctx, dataQuery, args...)
	if err != nil {
		log.Printf("[admin] search query error: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to search orders")
		return
	}
	defer rows.Close()

	orders := h.scanOrders(rows)

	response.OK(w, map[string]interface{}{
		"results":   orders,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// AdminOverrideStatus handles PATCH /api/orders/admin/order/{id}/override-status/
// Allows an admin to force an order into any status, bypassing the normal
// transition rules. The override reason is logged in the admin_status_overrides table.
func (h *Handler) AdminOverrideStatus(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	orderID := chi.URLParam(r, "id")

	var body struct {
		Status string `json:"status"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		response.Error(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if body.Status == "" {
		response.Error(w, http.StatusBadRequest, "status is required")
		return
	}
	if body.Reason == "" {
		response.Error(w, http.StatusBadRequest, "reason is required for admin override")
		return
	}

	// Validate the target status is a known status
	validStatuses := map[string]bool{
		"pending_payment": true, "paid": true, "preparing": true, "ready": true,
		"collected": true, "assigned": true, "out_for_delivery": true,
		"delivered": true, "cancelled": true, "scheduled": true,
	}
	if !validStatuses[body.Status] {
		response.Error(w, http.StatusBadRequest, "Invalid status: "+body.Status)
		return
	}

	// Fetch current status
	var currentStatus string
	err := h.db.QueryRow(ctx,
		`SELECT status FROM orders_order WHERE id = $1`, orderID).Scan(&currentStatus)
	if err != nil {
		response.Error(w, http.StatusNotFound, "Order not found")
		return
	}

	// Set timestamp fields based on target status
	var extraSet string
	switch body.Status {
	case "out_for_delivery":
		extraSet = ", delivery_out_time = NOW()"
	case "delivered":
		extraSet = ", delivery_complete_time = NOW()"
	}

	// Force update the status (bypass transition rules)
	_, err = h.db.Exec(ctx,
		fmt.Sprintf(`UPDATE orders_order SET status = $1%s WHERE id = $2`, extraSet),
		body.Status, orderID)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "Failed to override status")
		return
	}

	// Log the admin override. The table is created if it does not exist yet.
	h.db.Exec(ctx,
		`CREATE TABLE IF NOT EXISTS admin_status_overrides (
			id SERIAL PRIMARY KEY,
			order_id TEXT NOT NULL,
			from_status TEXT NOT NULL,
			to_status TEXT NOT NULL,
			reason TEXT NOT NULL,
			created_at TIMESTAMPTZ DEFAULT NOW()
		)`)
	h.db.Exec(ctx,
		`INSERT INTO admin_status_overrides (order_id, from_status, to_status, reason)
		 VALUES ($1, $2, $3, $4)`,
		orderID, currentStatus, body.Status, body.Reason)

	// Publish the status change event so realtime service picks it up
	h.pub.PublishOrderStatus(ctx, orderID, body.Status)

	response.OK(w, map[string]interface{}{
		"order_id":    orderID,
		"from_status": currentStatus,
		"to_status":   body.Status,
		"reason":      body.Reason,
		"overridden":  true,
	})
}

// AdminLiveStats handles GET /api/orders/admin/live-stats/
// Returns real-time operational stats: active orders by status, orders in
// the last hour, average delivery time today, and stuck orders.
func (h *Handler) AdminLiveStats(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Active orders count by status (only active statuses)
	activeStatuses := []string{"paid", "preparing", "ready", "collected", "assigned", "out_for_delivery"}
	activeRows, err := h.db.Query(ctx,
		`SELECT status, COUNT(*) FROM orders_order
		 WHERE status = ANY($1)
		 GROUP BY status`, activeStatuses)
	activeByStatus := make(map[string]int)
	totalActive := 0
	if err == nil && activeRows != nil {
		defer activeRows.Close()
		for activeRows.Next() {
			var s string
			var c int
			activeRows.Scan(&s, &c)
			activeByStatus[s] = c
			totalActive += c
		}
	}

	// Orders created in last hour
	var lastHourCount int
	h.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM orders_order WHERE created >= NOW() - INTERVAL '1 hour'`).
		Scan(&lastHourCount)

	// Average delivery time today (from out_for_delivery to delivered), in minutes
	var avgDeliveryMinutes *float64
	h.db.QueryRow(ctx,
		`SELECT AVG(EXTRACT(EPOCH FROM (delivery_complete_time - delivery_out_time)) / 60)
		 FROM orders_order
		 WHERE status = 'delivered'
		   AND delivery_out_time IS NOT NULL
		   AND delivery_complete_time IS NOT NULL
		   AND DATE(created) = CURRENT_DATE`).
		Scan(&avgDeliveryMinutes)

	var avgDelivery float64
	if avgDeliveryMinutes != nil {
		avgDelivery = *avgDeliveryMinutes
	}

	// Stuck orders: preparing > 30 min OR assigned > 15 min
	stuckRows, err := h.db.Query(ctx,
		`SELECT id, status, restaurant_names, created
		 FROM orders_order
		 WHERE (status = 'preparing' AND created < NOW() - INTERVAL '30 minutes')
		    OR (status = 'assigned' AND created < NOW() - INTERVAL '15 minutes')
		 ORDER BY created ASC`)
	var stuckOrders []map[string]interface{}
	if err == nil && stuckRows != nil {
		defer stuckRows.Close()
		for stuckRows.Next() {
			var id, statusVal string
			var restNames *string
			var created time.Time
			stuckRows.Scan(&id, &statusVal, &restNames, &created)
			entry := map[string]interface{}{
				"id":      id,
				"status":  statusVal,
				"created": created.Format(time.RFC3339),
			}
			if restNames != nil {
				entry["restaurant_names"] = *restNames
			}
			// Calculate how many minutes the order has been stuck
			stuckMinutes := time.Since(created).Minutes()
			entry["stuck_minutes"] = int(stuckMinutes)
			stuckOrders = append(stuckOrders, entry)
		}
	}
	if stuckOrders == nil {
		stuckOrders = []map[string]interface{}{}
	}

	response.OK(w, map[string]interface{}{
		"active_by_status":       activeByStatus,
		"total_active":           totalActive,
		"orders_last_hour":       lastHourCount,
		"avg_delivery_time_mins": avgDelivery,
		"stuck_orders":           stuckOrders,
		"stuck_orders_count":     len(stuckOrders),
	})
}

// AdminHourlyOrders handles GET /api/orders/admin/hourly/
// Returns orders per hour for today vs yesterday so the admin dashboard
// can render a comparative hourly chart.
func (h *Handler) AdminHourlyOrders(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Get today's and yesterday's hourly counts in a single query
	rows, err := h.db.Query(ctx,
		`SELECT
			EXTRACT(HOUR FROM created)::int AS hour,
			COUNT(*) FILTER (WHERE DATE(created) = CURRENT_DATE) AS today,
			COUNT(*) FILTER (WHERE DATE(created) = CURRENT_DATE - 1) AS yesterday
		 FROM orders_order
		 WHERE created >= (CURRENT_DATE - 1)
		 GROUP BY hour
		 ORDER BY hour`)
	if err != nil {
		log.Printf("[admin] hourly query error: %v", err)
		response.Error(w, http.StatusInternalServerError, "Failed to fetch hourly data")
		return
	}
	defer rows.Close()

	// Initialize all 24 hours to 0
	hourlyMap := make(map[int][2]int)
	for i := 0; i < 24; i++ {
		hourlyMap[i] = [2]int{0, 0}
	}

	for rows.Next() {
		var hour, today, yesterday int
		rows.Scan(&hour, &today, &yesterday)
		hourlyMap[hour] = [2]int{today, yesterday}
	}

	// Build the response array
	hourly := make([]map[string]int, 24)
	for i := 0; i < 24; i++ {
		hourly[i] = map[string]int{
			"hour":      i,
			"today":     hourlyMap[i][0],
			"yesterday": hourlyMap[i][1],
		}
	}

	response.OK(w, hourly)
}

// AdminHealthCheck handles GET /api/orders/health/ (enhanced)
// Returns service health including DB connection status and Redis ping.
func (h *Handler) AdminHealthCheck(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

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
		"service":   "order-service",
		"database":  dbStatus,
		"redis":     redisStatus,
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	})
}
