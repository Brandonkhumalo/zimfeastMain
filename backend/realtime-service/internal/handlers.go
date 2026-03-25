package internal

import (
	"log"

	socketio "github.com/googollee/go-socket.io"
)

// ──── Customer Handlers ────

// HandleCustomerJoin adds a customer to the Socket.IO room for an order
// and sends them the current order status if available.
func HandleCustomerJoin(s socketio.Conn, data map[string]interface{}, orderSvc *OrderService) {
	orderID := getString(data, "orderId")
	if orderID == "" {
		s.Emit("error", map[string]string{"message": "orderId required"})
		return
	}

	s.Join("order:" + orderID)

	order := orderSvc.GetOrder(orderID)
	if order != nil {
		statusData := map[string]interface{}{
			"orderId": orderID,
			"status":  order.Status,
		}
		// Include driver info if available (forwarded from TumaGo via order-service)
		if order.DriverInfo != nil {
			statusData["driver"] = order.DriverInfo
		}
		s.Emit("order:status", statusData)
	}

	log.Printf("[customer] joined order room: %s", orderID)
}

// HandleOrderSubscribe adds a customer to the Socket.IO room for an order.
func HandleOrderSubscribe(s socketio.Conn, data map[string]interface{}, orderSvc *OrderService) {
	orderID := getString(data, "orderId")
	if orderID == "" {
		return
	}
	s.Join("order:" + orderID)
	s.Emit("order:subscribed", map[string]interface{}{"orderId": orderID})
}

// HandleOrderUnsubscribe removes a customer from the Socket.IO room for an order.
func HandleOrderUnsubscribe(s socketio.Conn, data map[string]interface{}) {
	orderID := getString(data, "orderId")
	if orderID != "" {
		s.Leave("order:" + orderID)
	}
}

// HandleGetETA returns the current ETA for an order.
// ETA is computed from Google Directions API + prep time + traffic multiplier,
// or from driver live location when a TumaGo driver is assigned.
func HandleGetETA(s socketio.Conn, data map[string]interface{}, orderSvc *OrderService) {
	orderID := getString(data, "orderId")
	order := orderSvc.GetOrder(orderID)
	if order == nil {
		s.Emit("order:eta", map[string]interface{}{"error": "order not found"})
		return
	}

	resp := map[string]interface{}{
		"orderId": orderID,
		"status":  order.Status,
	}
	if order.ETA != nil {
		resp["eta"] = order.ETA
	}
	s.Emit("order:eta", resp)
}
