package internal

import (
	"log"

	socketio "github.com/googollee/go-socket.io"
)

// ──── Driver Handlers ────

func HandleDriverRegister(s socketio.Conn, data map[string]interface{}, drvSvc *DriverService) {
	driverID := getString(data, "driverId")
	if driverID == "" {
		s.Emit("error", map[string]string{"message": "driverId required"})
		return
	}

	name := getString(data, "name")
	phone := getString(data, "phone")
	lat := getFloat(data, "lat")
	lng := getFloat(data, "lng")

	var vehicle map[string]interface{}
	if v, ok := data["vehicle"].(map[string]interface{}); ok {
		vehicle = v
	}

	drvSvc.RegisterDriver(driverID, s.ID(), name, phone, lat, lng, vehicle)

	s.Join("driver:" + driverID)
	s.Emit("driver:registered", map[string]interface{}{
		"driverId": driverID,
		"status":   "available",
	})
}

func HandleDriverLocationUpdate(s socketio.Conn, data map[string]interface{}, drvSvc *DriverService, sio *socketio.Server) {
	driver := drvSvc.GetDriverBySocket(s.ID())
	if driver == nil {
		return
	}

	lat := getFloat(data, "lat")
	lng := getFloat(data, "lng")
	drvSvc.UpdateLocation(driver.ID, lat, lng)

	// Rate-limited broadcast to customer tracking this driver's order
	if driver.OrderID != "" && drvSvc.ShouldBroadcastLocation(driver.ID) {
		drvSvc.MarkBroadcast(driver.ID)
		sio.BroadcastToRoom("/customers", "order:"+driver.OrderID, "driver:location", map[string]interface{}{
			"driverId": driver.ID,
			"lat":      lat,
			"lng":      lng,
		})
	}
}

func HandleDeliveryAccept(s socketio.Conn, data map[string]interface{}, orderSvc *OrderService, sio *socketio.Server) {
	driver := orderSvc.drvSvc.GetDriverBySocket(s.ID())
	if driver == nil {
		s.Emit("error", map[string]string{"message": "driver not registered"})
		return
	}

	orderID := getString(data, "orderId")
	if err := orderSvc.HandleDriverAccept(driver.ID, orderID, sio); err != nil {
		s.Emit("delivery:accept_failed", map[string]interface{}{
			"orderId": orderID,
			"message": err.Error(),
		})
		return
	}

	s.Emit("delivery:accepted", map[string]interface{}{
		"orderId": orderID,
		"status":  "assigned",
	})
}

func HandleDeliveryReject(s socketio.Conn, data map[string]interface{}, orderSvc *OrderService, sio *socketio.Server) {
	driver := orderSvc.drvSvc.GetDriverBySocket(s.ID())
	if driver == nil {
		return
	}

	orderID := getString(data, "orderId")
	reason := getString(data, "reason")
	orderSvc.HandleDriverReject(driver.ID, orderID, reason, sio)

	s.Emit("delivery:rejected", map[string]interface{}{
		"orderId": orderID,
	})
}

func HandleDeliveryStatus(s socketio.Conn, data map[string]interface{}, orderSvc *OrderService, sio *socketio.Server) {
	driver := orderSvc.drvSvc.GetDriverBySocket(s.ID())
	if driver == nil {
		return
	}

	orderID := getString(data, "orderId")
	status := getString(data, "status")

	orderSvc.UpdateOrderStatus(orderID, status, sio)

	s.Emit("delivery:status_updated", map[string]interface{}{
		"orderId": orderID,
		"status":  status,
	})
}

func HandleDriverGoOffline(s socketio.Conn, drvSvc *DriverService) {
	driver := drvSvc.GetDriverBySocket(s.ID())
	if driver == nil {
		return
	}
	drvSvc.SetDriverStatus(driver.ID, "offline")
	s.Emit("driver:offline", map[string]interface{}{
		"driverId": driver.ID,
	})
	log.Printf("[driver] %s went offline", driver.ID)
}

func HandleDriverGoOnline(s socketio.Conn, drvSvc *DriverService) {
	driver := drvSvc.GetDriverBySocket(s.ID())
	if driver == nil {
		return
	}
	drvSvc.SetDriverStatus(driver.ID, "available")
	s.Emit("driver:online", map[string]interface{}{
		"driverId": driver.ID,
	})
	log.Printf("[driver] %s went online", driver.ID)
}

func HandleDriverDisconnect(s socketio.Conn, drvSvc *DriverService) {
	driver := drvSvc.GetDriverBySocket(s.ID())
	if driver != nil {
		log.Printf("[driver] disconnected: %s", driver.ID)
	}
	drvSvc.RemoveDriver(s.ID())
}

// ──── Customer Handlers ────

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
		if order.DriverID != "" {
			driver := orderSvc.drvSvc.GetDriver(order.DriverID)
			if driver != nil {
				statusData["driver"] = map[string]interface{}{
					"id": driver.ID, "name": driver.Name,
					"phone": driver.Phone, "lat": driver.Lat, "lng": driver.Lng,
				}
			}
		}
		s.Emit("order:status", statusData)
	}
}

func HandleOrderSubscribe(s socketio.Conn, data map[string]interface{}, orderSvc *OrderService) {
	orderID := getString(data, "orderId")
	if orderID == "" {
		return
	}
	s.Join("order:" + orderID)
	s.Emit("order:subscribed", map[string]interface{}{"orderId": orderID})
}

func HandleOrderUnsubscribe(s socketio.Conn, data map[string]interface{}) {
	orderID := getString(data, "orderId")
	if orderID != "" {
		s.Leave("order:" + orderID)
	}
}

func HandleGetETA(s socketio.Conn, data map[string]interface{}, orderSvc *OrderService) {
	orderID := getString(data, "orderId")
	eta := orderSvc.CalculateETA(orderID)
	s.Emit("order:eta", eta)
}

func HandleDriverRate(s socketio.Conn, data map[string]interface{}, orderSvc *OrderService) {
	driverID := getString(data, "driverId")
	rating := getFloat(data, "rating")
	comment := getString(data, "comment")

	if driverID == "" || rating < 1 || rating > 5 {
		s.Emit("error", map[string]string{"message": "invalid rating data"})
		return
	}

	if err := orderSvc.SubmitRating(driverID, rating, comment); err != nil {
		s.Emit("error", map[string]string{"message": "failed to submit rating"})
		return
	}

	s.Emit("driver:rated", map[string]interface{}{
		"driverId": driverID,
		"rating":   rating,
	})
}
