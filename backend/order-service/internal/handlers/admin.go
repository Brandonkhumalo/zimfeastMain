package handlers

import (
	"net/http"
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
