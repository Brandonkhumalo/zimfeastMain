package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	socketio "github.com/googollee/go-socket.io"
	"github.com/googollee/go-socket.io/engineio"
	"github.com/googollee/go-socket.io/engineio/transport"
	"github.com/googollee/go-socket.io/engineio/transport/polling"
	"github.com/googollee/go-socket.io/engineio/transport/websocket"

	"zimfeast/shared/config"
	"zimfeast/shared/redispub"
	"zimfeast/realtime/internal"
)

func main() {
	cfg := config.Load()
	pub := redispub.New(cfg.RedisURL)
	defer pub.Close()

	driverSvc := internal.NewDriverService(pub)
	orderSvc := internal.NewOrderService(pub, driverSvc, cfg)

	// Socket.IO server
	sio := socketio.NewServer(&engineio.Options{
		Transports: []transport.Transport{
			&polling.Transport{},
			&websocket.Transport{},
		},
	})

	// Driver namespace
	sio.OnConnect("/drivers", func(s socketio.Conn) error {
		log.Printf("[drivers] connected: %s", s.ID())
		return nil
	})

	sio.OnEvent("/drivers", "driver:register", func(s socketio.Conn, data map[string]interface{}) {
		internal.HandleDriverRegister(s, data, driverSvc)
	})

	sio.OnEvent("/drivers", "driver:location_update", func(s socketio.Conn, data map[string]interface{}) {
		internal.HandleDriverLocationUpdate(s, data, driverSvc, sio)
	})

	sio.OnEvent("/drivers", "delivery:accept", func(s socketio.Conn, data map[string]interface{}) {
		internal.HandleDeliveryAccept(s, data, orderSvc, sio)
	})

	sio.OnEvent("/drivers", "delivery:reject", func(s socketio.Conn, data map[string]interface{}) {
		internal.HandleDeliveryReject(s, data, orderSvc, sio)
	})

	sio.OnEvent("/drivers", "delivery:status", func(s socketio.Conn, data map[string]interface{}) {
		internal.HandleDeliveryStatus(s, data, orderSvc, sio)
	})

	sio.OnEvent("/drivers", "driver:go_offline", func(s socketio.Conn, data map[string]interface{}) {
		internal.HandleDriverGoOffline(s, driverSvc)
	})

	sio.OnEvent("/drivers", "driver:go_online", func(s socketio.Conn, data map[string]interface{}) {
		internal.HandleDriverGoOnline(s, driverSvc)
	})

	sio.OnDisconnect("/drivers", func(s socketio.Conn, reason string) {
		internal.HandleDriverDisconnect(s, driverSvc)
	})

	// Customer namespace
	sio.OnConnect("/customers", func(s socketio.Conn) error {
		log.Printf("[customers] connected: %s", s.ID())
		return nil
	})

	sio.OnEvent("/customers", "customer:join", func(s socketio.Conn, data map[string]interface{}) {
		internal.HandleCustomerJoin(s, data, orderSvc)
	})

	sio.OnEvent("/customers", "order:subscribe", func(s socketio.Conn, data map[string]interface{}) {
		internal.HandleOrderSubscribe(s, data, orderSvc)
	})

	sio.OnEvent("/customers", "order:unsubscribe", func(s socketio.Conn, data map[string]interface{}) {
		internal.HandleOrderUnsubscribe(s, data)
	})

	sio.OnEvent("/customers", "order:get_eta", func(s socketio.Conn, data map[string]interface{}) {
		internal.HandleGetETA(s, data, orderSvc)
	})

	sio.OnEvent("/customers", "driver:rate", func(s socketio.Conn, data map[string]interface{}) {
		internal.HandleDriverRate(s, data, orderSvc)
	})

	sio.OnDisconnect("/customers", func(s socketio.Conn, reason string) {
		log.Printf("[customers] disconnected: %s reason: %s", s.ID(), reason)
	})

	go func() {
		if err := sio.Serve(); err != nil {
			log.Fatalf("[socketio] serve error: %v", err)
		}
	}()
	defer sio.Close()

	// Redis subscriptions for order events
	go subscribeRedisEvents(pub, orderSvc, sio)

	// HTTP router
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	}))

	// Socket.IO handler
	r.Handle("/socket.io/", sio)

	// REST endpoints
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "ok",
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	r.Get("/api/drivers/online", func(w http.ResponseWriter, r *http.Request) {
		drivers := driverSvc.GetOnlineDrivers()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(drivers)
	})

	r.Post("/api/drivers/{driverId}/location", func(w http.ResponseWriter, r *http.Request) {
		driverID := chi.URLParam(r, "driverId")
		var body struct {
			Lat float64 `json:"lat"`
			Lng float64 `json:"lng"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, `{"error":"invalid body"}`, 400)
			return
		}
		driverSvc.UpdateLocation(driverID, body.Lat, body.Lng)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{"status": "updated"})
	})

	r.Get("/api/orders/{orderId}/eta", func(w http.ResponseWriter, r *http.Request) {
		orderID := chi.URLParam(r, "orderId")
		eta := orderSvc.CalculateETA(orderID)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(eta)
	})

	r.Post("/api/orders/new-delivery", func(w http.ResponseWriter, r *http.Request) {
		var orderData map[string]interface{}
		if err := json.NewDecoder(r.Body).Decode(&orderData); err != nil {
			http.Error(w, `{"error":"invalid body"}`, 400)
			return
		}
		go orderSvc.HandleNewDeliveryOrder(orderData, sio)
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "processing",
			"orderId": orderData["orderId"],
		})
	})

	port := os.Getenv("REALTIME_PORT")
	if port == "" {
		port = "3001"
	}

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: r,
	}

	// Graceful shutdown
	go func() {
		log.Printf("[server] realtime service listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[server] listen error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[server] shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}

func subscribeRedisEvents(pub *redispub.Publisher, orderSvc *internal.OrderService, sio *socketio.Server) {
	ctx := context.Background()
	sub := pub.Subscribe(ctx, "orders.delivery.created", "orders.status.changed")
	defer sub.Close()

	ch := sub.Channel()
	for msg := range ch {
		var data map[string]interface{}
		if err := json.Unmarshal([]byte(msg.Payload), &data); err != nil {
			log.Printf("[redis] failed to parse message on %s: %v", msg.Channel, err)
			continue
		}

		switch msg.Channel {
		case "orders.delivery.created":
			go orderSvc.HandleNewDeliveryOrder(data, sio)
		case "orders.status.changed":
			orderID, _ := data["orderId"].(string)
			if orderID != "" {
				sio.BroadcastToRoom("/customers", "order:"+orderID, "order:status", data)
			}
		}
	}
}
