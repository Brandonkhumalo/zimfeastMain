package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"os/signal"
	"strings"
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
	"zimfeast/shared/eta"
	"zimfeast/shared/redispub"
	"zimfeast/realtime/internal"
)

func main() {
	cfg := config.Load()
	pub := redispub.New(cfg.RedisURL)
	defer pub.Close()

	etaCalc := eta.NewCalculator(cfg.GoogleAPIKey)
	orderSvc := internal.NewOrderService(pub, etaCalc)

	// Restore in-memory state from Redis (crash recovery)
	ordersRestored, err := orderSvc.RestoreFromRedis(context.Background())
	if err != nil {
		log.Printf("[startup] warning: failed to restore orders from Redis: %v", err)
	}
	log.Printf("[startup] restored %d active orders from Redis", ordersRestored)

	// Socket.IO server
	sio := socketio.NewServer(&engineio.Options{
		Transports: []transport.Transport{
			&polling.Transport{},
			&websocket.Transport{},
		},
	})

	// Customer namespace — customers track order status and driver location in real time
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

	sio.OnDisconnect("/customers", func(s socketio.Conn, reason string) {
		log.Printf("[customers] disconnected: %s reason: %s", s.ID(), reason)
	})

	go func() {
		if err := sio.Serve(); err != nil {
			log.Fatalf("[socketio] serve error: %v", err)
		}
	}()
	defer sio.Close()

	// Redis subscriptions for order events from order-service (which receives TumaGo webhooks)
	go subscribeRedisEvents(pub, orderSvc, sio)

	// HTTP router
	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	// CORS: read allowed origins from env, default to localhost for safety
	corsOrigins := strings.Split(os.Getenv("CORS_ALLOWED_ORIGINS"), ",")
	if len(corsOrigins) == 0 || (len(corsOrigins) == 1 && corsOrigins[0] == "") {
		corsOrigins = []string{"http://localhost:5000", "http://localhost:3000"}
	}
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   corsOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		AllowCredentials: true,
	}))

	// Socket.IO handler
	r.Handle("/socket.io/", sio)

	// REST endpoints
	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		// Enhanced health check with Redis ping
		redisStatus := "ok"
		if err := pub.Client().Ping(context.Background()).Err(); err != nil {
			redisStatus = fmt.Sprintf("error: %v", err)
		}

		overallStatus := "ok"
		if redisStatus != "ok" {
			overallStatus = "degraded"
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    overallStatus,
			"service":   "realtime-service",
			"redis":     redisStatus,
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		})
	})

	r.Get("/api/orders/{orderId}/eta", func(w http.ResponseWriter, r *http.Request) {
		orderID := chi.URLParam(r, "orderId")
		order := orderSvc.GetOrder(orderID)
		if order == nil {
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{"error": "order not found"})
			return
		}
		resp := map[string]interface{}{
			"orderId": orderID,
			"status":  order.Status,
		}
		if order.ETA != nil {
			resp["eta"] = order.ETA
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
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

// subscribeRedisEvents listens for order events published by order-service
// (which receives status updates from TumaGo via webhooks) and forwards them
// to connected customers via Socket.IO.
func subscribeRedisEvents(pub *redispub.Publisher, orderSvc *internal.OrderService, sio *socketio.Server) {
	backoff := time.Second // Start with 1s backoff
	maxBackoff := 30 * time.Second

	for {
		ctx := context.Background()
		sub := pub.Subscribe(ctx,
			"orders.status.changed",       // Order status updates from order-service
			"orders.driver.location",      // Driver location forwarded from TumaGo webhooks
		)

		ch := sub.Channel()
		for msg := range ch {
			// Reset backoff on successful message receive
			backoff = time.Second

			var data map[string]interface{}
			if err := json.Unmarshal([]byte(msg.Payload), &data); err != nil {
				log.Printf("[redis] failed to parse message on %s: %v", msg.Channel, err)
				continue
			}

			switch msg.Channel {
			case "orders.status.changed":
				orderID, _ := data["orderId"].(string)
				status, _ := data["status"].(string)
				if orderID != "" && status != "" {
					orderSvc.HandleStatusUpdate(orderID, status, data, sio)
				}

			case "orders.driver.location":
				// Driver location from TumaGo → order-service → Redis → here → customer
				orderID, _ := data["orderId"].(string)
				if orderID != "" {
					orderSvc.HandleDriverLocation(orderID, data, sio)
				}
			}
		}

		// Channel closed — Redis disconnected
		sub.Close()
		log.Printf("[redis] subscription channel closed, reconnecting in %v...", backoff)
		time.Sleep(backoff)

		// Exponential backoff: double the wait time, cap at maxBackoff
		backoff = time.Duration(math.Min(float64(backoff*2), float64(maxBackoff)))
	}
}
