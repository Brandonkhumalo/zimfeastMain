package internal

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	socketio "github.com/googollee/go-socket.io"

	"zimfeast/shared/config"
	"zimfeast/shared/geo"
	"zimfeast/shared/redispub"
)

type ActiveOrder struct {
	OrderID        string  `json:"orderId"`
	CustomerID     string  `json:"customerId"`
	CustomerName   string  `json:"customerName"`
	RestaurantID   string  `json:"restaurantId"`
	RestaurantName string  `json:"restaurantName"`
	RestaurantLat  float64 `json:"restaurantLat"`
	RestaurantLng  float64 `json:"restaurantLng"`
	DeliveryLat    float64 `json:"deliveryLat"`
	DeliveryLng    float64 `json:"deliveryLng"`
	DeliveryAddr   string  `json:"deliveryAddress"`
	TotalFee       float64 `json:"totalFee"`
	DeliveryFee    float64 `json:"deliveryFee"`
	Status         string  `json:"status"`
	DriverID       string  `json:"driverId"`
	OfferIndex     int     `json:"offerIndex"`
}

type OrderService struct {
	mu     sync.RWMutex
	orders map[string]*ActiveOrder
	pub    *redispub.Publisher
	drvSvc *DriverService
	cfg    *config.Config
}

func NewOrderService(pub *redispub.Publisher, drvSvc *DriverService, cfg *config.Config) *OrderService {
	return &OrderService{
		orders: make(map[string]*ActiveOrder),
		pub:    pub,
		drvSvc: drvSvc,
		cfg:    cfg,
	}
}

func (os *OrderService) HandleNewDeliveryOrder(data map[string]interface{}, sio *socketio.Server) {
	orderID := getString(data, "orderId")
	if orderID == "" {
		log.Println("[order] missing orderId in delivery order")
		return
	}

	order := &ActiveOrder{
		OrderID:        orderID,
		CustomerID:     getString(data, "customerId"),
		CustomerName:   getString(data, "customerName"),
		RestaurantID:   getString(data, "restaurantId"),
		RestaurantName: getString(data, "restaurantName"),
		RestaurantLat:  getFloat(data, "restaurantLat"),
		RestaurantLng:  getFloat(data, "restaurantLng"),
		DeliveryLat:    getFloat(data, "deliveryLat"),
		DeliveryLng:    getFloat(data, "deliveryLng"),
		DeliveryAddr:   getString(data, "deliveryAddress"),
		TotalFee:       getFloat(data, "totalFee"),
		DeliveryFee:    getFloat(data, "deliveryFee"),
		Status:         "finding_driver",
		OfferIndex:     0,
	}

	os.mu.Lock()
	os.orders[orderID] = order
	os.mu.Unlock()

	// Store in Redis for crash resilience
	ctx := context.Background()
	orderJSON, _ := json.Marshal(order)
	os.pub.Client().HSet(ctx, "order:"+orderID, "data", string(orderJSON))

	log.Printf("[order] new delivery: %s", orderID)
	os.findAndOfferToDriver(order, sio)
}

func (os *OrderService) findAndOfferToDriver(order *ActiveOrder, sio *socketio.Server) {
	drivers := os.drvSvc.FindNearestAvailableDrivers(order.RestaurantLat, order.RestaurantLng, 5)

	if order.OfferIndex >= len(drivers) {
		log.Printf("[order] no drivers available for %s", order.OrderID)
		sio.BroadcastToRoom("/customers", "order:"+order.OrderID, "order:no_drivers", map[string]interface{}{
			"orderId": order.OrderID,
			"message": "No drivers available at this time",
		})
		return
	}

	driver := drivers[order.OfferIndex]

	// Atomic lock with Redis SETNX
	ctx := context.Background()
	lockKey := "offer:lock:" + order.OrderID
	ok, err := os.pub.Client().SetNX(ctx, lockKey, driver.ID, 30*time.Second).Result()
	if err != nil || !ok {
		log.Printf("[order] offer lock failed for %s", order.OrderID)
		return
	}

	distance := geo.HaversineDistance(driver.Lat, driver.Lng, order.RestaurantLat, order.RestaurantLng)

	offerData := map[string]interface{}{
		"orderId":         order.OrderID,
		"restaurantName":  order.RestaurantName,
		"restaurantLat":   order.RestaurantLat,
		"restaurantLng":   order.RestaurantLng,
		"deliveryLat":     order.DeliveryLat,
		"deliveryLng":     order.DeliveryLng,
		"deliveryAddress": order.DeliveryAddr,
		"totalFee":        order.TotalFee,
		"deliveryFee":     order.DeliveryFee,
		"distance":        fmt.Sprintf("%.1f km", distance),
	}

	// Send offer to specific driver via their socket
	sio.BroadcastToRoom("/drivers", "driver:"+driver.ID, "delivery:offer", offerData)
	log.Printf("[order] offered %s to driver %s (%.1f km away)", order.OrderID, driver.ID, distance)

	// Set offer expiry - auto-reject after 30 seconds
	go func() {
		time.Sleep(30 * time.Second)
		ctx := context.Background()
		lockVal, _ := os.pub.Client().Get(ctx, lockKey).Result()
		if lockVal == driver.ID {
			log.Printf("[order] offer expired for %s, trying next driver", order.OrderID)
			os.pub.Client().Del(ctx, lockKey)
			os.mu.Lock()
			order.OfferIndex++
			os.mu.Unlock()
			os.findAndOfferToDriver(order, sio)
		}
	}()
}

func (os *OrderService) HandleDriverAccept(driverID, orderID string, sio *socketio.Server) error {
	ctx := context.Background()
	lockKey := "offer:lock:" + orderID

	// Verify this driver holds the lock
	lockVal, err := os.pub.Client().Get(ctx, lockKey).Result()
	if err != nil || lockVal != driverID {
		return fmt.Errorf("offer no longer available")
	}

	// Claim it
	os.pub.Client().Del(ctx, lockKey)

	os.mu.Lock()
	order, ok := os.orders[orderID]
	if ok {
		order.Status = "driver_assigned"
		order.DriverID = driverID
	}
	os.mu.Unlock()

	if !ok {
		return fmt.Errorf("order not found")
	}

	os.drvSvc.SetDriverOrder(driverID, orderID)

	driver := os.drvSvc.GetDriver(driverID)
	if driver == nil {
		return fmt.Errorf("driver not found")
	}

	// Notify customer
	sio.BroadcastToRoom("/customers", "order:"+orderID, "order:driver_assigned", map[string]interface{}{
		"orderId":     orderID,
		"driverId":    driverID,
		"driverName":  driver.Name,
		"driverPhone": driver.Phone,
		"vehicle":     driver.Vehicle,
		"lat":         driver.Lat,
		"lng":         driver.Lng,
	})

	// Update order-service via REST
	go os.notifyOrderService(orderID, driverID, driver)

	log.Printf("[order] driver %s accepted order %s", driverID, orderID)
	return nil
}

func (os *OrderService) HandleDriverReject(driverID, orderID, reason string, sio *socketio.Server) {
	ctx := context.Background()
	lockKey := "offer:lock:" + orderID
	os.pub.Client().Del(ctx, lockKey)

	os.mu.Lock()
	order, ok := os.orders[orderID]
	if ok {
		order.OfferIndex++
	}
	os.mu.Unlock()

	log.Printf("[order] driver %s rejected order %s: %s", driverID, orderID, reason)

	if ok {
		os.findAndOfferToDriver(order, sio)
	}
}

func (os *OrderService) UpdateOrderStatus(orderID, status string, sio *socketio.Server) {
	os.mu.Lock()
	order, ok := os.orders[orderID]
	if ok {
		order.Status = status
	}
	os.mu.Unlock()

	sio.BroadcastToRoom("/customers", "order:"+orderID, "order:status", map[string]interface{}{
		"orderId": orderID,
		"status":  status,
	})

	if status == "delivered" {
		os.mu.Lock()
		if order, ok := os.orders[orderID]; ok {
			if order.DriverID != "" {
				os.drvSvc.ClearDriverOrder(order.DriverID)
			}
		}
		os.mu.Unlock()

		// Send completion event
		sio.BroadcastToRoom("/customers", "order:"+orderID, "order:completed", map[string]interface{}{
			"orderId": orderID,
			"message": "Your order has been delivered!",
		})
	}

	// Publish to Redis
	os.pub.PublishOrderStatus(context.Background(), orderID, status)
}

func (os *OrderService) GetOrder(orderID string) *ActiveOrder {
	os.mu.RLock()
	defer os.mu.RUnlock()
	if o, ok := os.orders[orderID]; ok {
		cp := *o
		return &cp
	}
	return nil
}

func (os *OrderService) CalculateETA(orderID string) map[string]interface{} {
	os.mu.RLock()
	order, ok := os.orders[orderID]
	os.mu.RUnlock()

	if !ok {
		return map[string]interface{}{"error": "order not found"}
	}

	var distance float64
	if order.DriverID != "" {
		driver := os.drvSvc.GetDriver(order.DriverID)
		if driver != nil {
			if order.Status == "out_for_delivery" {
				distance = geo.HaversineDistance(driver.Lat, driver.Lng, order.DeliveryLat, order.DeliveryLng)
			} else {
				toRestaurant := geo.HaversineDistance(driver.Lat, driver.Lng, order.RestaurantLat, order.RestaurantLng)
				toCustomer := geo.HaversineDistance(order.RestaurantLat, order.RestaurantLng, order.DeliveryLat, order.DeliveryLng)
				distance = toRestaurant + toCustomer
			}
		}
	} else {
		distance = geo.HaversineDistance(order.RestaurantLat, order.RestaurantLng, order.DeliveryLat, order.DeliveryLng)
	}

	// Assume average 30 km/h in city
	etaMinutes := (distance / 30.0) * 60.0
	if etaMinutes < 5 {
		etaMinutes = 5
	}

	return map[string]interface{}{
		"eta":      int(etaMinutes),
		"distance": fmt.Sprintf("%.1f", distance),
		"unit":     "minutes",
	}
}

func (os *OrderService) SubmitRating(driverID string, rating float64, comment string) error {
	url := os.cfg.DriverServiceURL + "/api/drivers/rate/driver/"
	body, _ := json.Marshal(map[string]interface{}{
		"driver_id": driverID,
		"rating":    rating,
		"comment":   comment,
	})

	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("rating submission failed: %d", resp.StatusCode)
	}
	return nil
}

func (os *OrderService) notifyOrderService(orderID, driverID string, driver *DriverInfo) {
	url := os.cfg.OrderServiceURL + "/api/orders/order/" + orderID + "/assign-driver/"
	body, _ := json.Marshal(map[string]interface{}{
		"driver_id":      driverID,
		"driver_name":    driver.Name,
		"driver_phone":   driver.Phone,
		"driver_vehicle": driver.Vehicle,
	})

	req, _ := http.NewRequest("POST", url, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-Key", os.cfg.ServiceAPIKey)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("[order] failed to notify order-service for %s: %v", orderID, err)
		return
	}
	defer resp.Body.Close()
	log.Printf("[order] notified order-service for %s: %d", orderID, resp.StatusCode)
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

func getFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key]; ok {
		switch n := v.(type) {
		case float64:
			return n
		case int:
			return float64(n)
		}
	}
	return 0
}
