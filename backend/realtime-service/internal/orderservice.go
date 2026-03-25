package internal

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	socketio "github.com/googollee/go-socket.io"

	"zimfeast/shared/eta"
	"zimfeast/shared/redispub"
)

// ActiveOrder tracks an order's state in memory for broadcasting to customers.
// Status updates now come from order-service (which receives them from TumaGo webhooks).
type ActiveOrder struct {
	OrderID       string                 `json:"orderId"`
	CustomerID    string                 `json:"customerId"`
	CustomerName  string                 `json:"customerName"`
	RestaurantID  string                 `json:"restaurantId,omitempty"`
	RestaurantLat float64                `json:"restaurantLat,omitempty"`
	RestaurantLng float64                `json:"restaurantLng,omitempty"`
	DeliveryLat   float64                `json:"deliveryLat"`
	DeliveryLng   float64                `json:"deliveryLng"`
	DeliveryAddr  string                 `json:"deliveryAddress"`
	Status        string                 `json:"status"`
	DriverInfo    map[string]interface{} `json:"driverInfo,omitempty"`
	DriverLat     float64                `json:"driverLat,omitempty"`
	DriverLng     float64                `json:"driverLng,omitempty"`
	ETA           *eta.ETAResult         `json:"eta,omitempty"`
	// PaidAt tracks when the order was paid so we can compute actual prep time
	PaidAt        int64                  `json:"paidAt,omitempty"`
}

type OrderService struct {
	mu     sync.RWMutex
	orders map[string]*ActiveOrder
	pub    *redispub.Publisher
	eta    *eta.Calculator
}

func NewOrderService(pub *redispub.Publisher, etaCalc *eta.Calculator) *OrderService {
	return &OrderService{
		orders: make(map[string]*ActiveOrder),
		pub:    pub,
		eta:    etaCalc,
	}
}

// RestoreFromRedis rebuilds in-memory active order state from Redis after a restart.
// Only restores orders that are still in active delivery states.
func (os *OrderService) RestoreFromRedis(ctx context.Context) (int, error) {
	os.mu.Lock()
	defer os.mu.Unlock()

	// Scan for all order keys in Redis
	var cursor uint64
	restored := 0
	activeStatuses := map[string]bool{
		"finding_driver":  true,
		"driver_assigned": true,
		"picked_up":       true,
		"out_for_delivery": true,
	}

	for {
		keys, nextCursor, err := os.pub.Client().Scan(ctx, cursor, "order:*", 100).Result()
		if err != nil {
			return restored, fmt.Errorf("failed to scan order keys: %w", err)
		}

		for _, key := range keys {
			data, err := os.pub.Client().HGet(ctx, key, "data").Result()
			if err != nil || data == "" {
				continue
			}

			var order ActiveOrder
			if err := json.Unmarshal([]byte(data), &order); err != nil {
				continue
			}

			// Only restore orders in active delivery states
			if activeStatuses[order.Status] {
				os.orders[order.OrderID] = &order
				restored++
			}
		}

		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}

	return restored, nil
}

// HandleStatusUpdate processes a status change from order-service (via Redis pub/sub)
// and broadcasts it to all customers subscribed to this order's room.
func (os *OrderService) HandleStatusUpdate(orderID, status string, data map[string]interface{}, sio *socketio.Server) {
	os.mu.Lock()
	order, exists := os.orders[orderID]
	if !exists {
		// Create a new in-memory order entry from the event data
		order = &ActiveOrder{
			OrderID:      orderID,
			CustomerID:   getString(data, "customerId"),
			RestaurantID: getString(data, "restaurantId"),
			Status:       status,
		}
		// Parse coordinates from the status event if present
		if v, ok := data["restaurantLat"].(float64); ok {
			order.RestaurantLat = v
		}
		if v, ok := data["restaurantLng"].(float64); ok {
			order.RestaurantLng = v
		}
		if v, ok := data["deliveryLat"].(float64); ok {
			order.DeliveryLat = v
		}
		if v, ok := data["deliveryLng"].(float64); ok {
			order.DeliveryLng = v
		}
		os.orders[orderID] = order
	}
	order.Status = status

	// Track when order is paid so we can measure actual prep time later
	if status == "paid" {
		order.PaidAt = time.Now().Unix()
	}

	// Record actual prep time when restaurant marks order as ready
	if status == "ready" && order.PaidAt > 0 && order.RestaurantID != "" {
		prepMinutes := float64(time.Now().Unix()-order.PaidAt) / 60.0
		if prepMinutes > 0 && prepMinutes < 120 { // sanity: ignore > 2h
			os.eta.RecordPrepTime(order.RestaurantID, prepMinutes)
		}
	}

	// Capture driver info if provided in the status update
	if driverInfo, ok := data["driver"].(map[string]interface{}); ok {
		order.DriverInfo = driverInfo
	}

	// Compute ETA based on current status and available data
	os.computeETA(order)
	os.mu.Unlock()

	// Attach ETA to the broadcast payload
	if order.ETA != nil {
		data["eta"] = order.ETA
	}

	// Broadcast the full status payload to customers tracking this order
	sio.BroadcastToRoom("/customers", "order:"+orderID, "order:status", data)
	log.Printf("[order] status update: %s → %s", orderID, status)

	// Clean up completed/cancelled orders from memory
	if status == "delivered" || status == "cancelled" {
		os.mu.Lock()
		delete(os.orders, orderID)
		os.mu.Unlock()

		// Remove from Redis
		os.pub.Client().Del(context.Background(), "order:"+orderID)

		if status == "delivered" {
			sio.BroadcastToRoom("/customers", "order:"+orderID, "order:completed", map[string]interface{}{
				"orderId": orderID,
				"message": "Your order has been delivered!",
			})
		}
	} else {
		// Persist updated state to Redis for crash resilience
		orderJSON, _ := json.Marshal(order)
		os.pub.Client().HSet(context.Background(), "order:"+orderID, "data", string(orderJSON))
	}
}

// HandleDriverLocation broadcasts a TumaGo driver's location to customers tracking the order.
// Data flow: TumaGo webhook → order-service → Redis pub/sub → here → Socket.IO → customer.
// Also recomputes ETA from the driver's current position to the delivery address.
func (os *OrderService) HandleDriverLocation(orderID string, data map[string]interface{}, sio *socketio.Server) {
	driverLat, _ := data["driverLat"].(float64)
	driverLng, _ := data["driverLng"].(float64)

	os.mu.Lock()
	if order, ok := os.orders[orderID]; ok && driverLat != 0 && driverLng != 0 {
		order.DriverLat = driverLat
		order.DriverLng = driverLng

		// Recompute ETA from driver → delivery address
		if order.DeliveryLat != 0 && order.DeliveryLng != 0 {
			etaResult := os.eta.CalculateFromDriver(
				context.Background(),
				driverLat, driverLng,
				order.DeliveryLat, order.DeliveryLng,
			)
			etaResult.Source = "tumago"
			order.ETA = &etaResult
			data["eta"] = &etaResult
		}
	}
	os.mu.Unlock()

	sio.BroadcastToRoom("/customers", "order:"+orderID, "driver:location", data)
}

// GetOrder returns a copy of the order for the given ID, or nil if not found.
func (os *OrderService) GetOrder(orderID string) *ActiveOrder {
	os.mu.RLock()
	defer os.mu.RUnlock()
	if o, ok := os.orders[orderID]; ok {
		cp := *o
		return &cp
	}
	return nil
}

// computeETA calculates the ETA for an order based on its current status.
// Must be called with os.mu held (write lock).
func (os *OrderService) computeETA(order *ActiveOrder) {
	ctx := context.Background()

	switch order.Status {
	case "paid", "preparing", "ready", "awaiting_driver":
		// ETA = restaurant prep + driving from restaurant → customer
		if order.RestaurantLat != 0 && order.DeliveryLat != 0 {
			result := os.eta.Calculate(ctx, order.RestaurantID,
				order.RestaurantLat, order.RestaurantLng,
				order.DeliveryLat, order.DeliveryLng,
			)
			order.ETA = &result
		}

	case "assigned", "out_for_delivery":
		// If we have the driver's position, compute from driver → customer
		if order.DriverLat != 0 && order.DeliveryLat != 0 {
			result := os.eta.CalculateFromDriver(ctx,
				order.DriverLat, order.DriverLng,
				order.DeliveryLat, order.DeliveryLng,
			)
			result.Source = "tumago"
			order.ETA = &result
		} else if order.RestaurantLat != 0 && order.DeliveryLat != 0 {
			// Fallback: estimate from restaurant if no driver location yet
			result := os.eta.Calculate(ctx, order.RestaurantID,
				order.RestaurantLat, order.RestaurantLng,
				order.DeliveryLat, order.DeliveryLng,
			)
			order.ETA = &result
		}

	case "delivered", "cancelled":
		order.ETA = nil
	}
}

// GetETACalculator returns the ETA calculator for external use (e.g. REST endpoints).
func (os *OrderService) GetETACalculator() *eta.Calculator {
	return os.eta
}

// Helpers
func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
