package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/jackc/pgx/v5/pgxpool"

	"zimfeast/shared/auth"
	"zimfeast/shared/config"
	"zimfeast/shared/redispub"

	"zimfeast/order/internal/handlers"
	"zimfeast/order/internal/scheduler"
)

func main() {
	cfg := config.Load()

	dbName := os.Getenv("ORDER_DB_NAME")
	if dbName == "" {
		dbName = "zimfeast_orders"
	}

	pool, err := pgxpool.New(context.Background(), cfg.DatabaseURL(dbName))
	if err != nil {
		log.Fatalf("[db] connection failed: %v", err)
	}
	defer pool.Close()

	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("[db] ping failed: %v", err)
	}
	log.Println("[db] connected")

	pub := redispub.New(cfg.RedisURL)
	defer pub.Close()

	h := handlers.New(pool, pub, cfg)

	// Start the scheduled-order dispatcher. It runs every 30 seconds, checking
	// for orders whose scheduled_for time has arrived and transitioning them
	// from "scheduled" to "pending_payment". The context is cancelled during
	// shutdown so the goroutine exits cleanly.
	schedulerCtx, schedulerCancel := context.WithCancel(context.Background())
	defer schedulerCancel()
	sched := scheduler.New(pool, pub)
	sched.Start(schedulerCtx)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Timeout(30 * time.Second))
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
	r.Use(httprate.LimitByIP(100, 1*time.Minute))

	// Public endpoints (no auth)
	r.Get("/api/orders/health/", h.AdminHealthCheck)
	r.Get("/api/orders/all/orders/", h.AllOrders)
	r.Get("/api/orders/order/{id}/", h.GetOrder)
	r.Post("/api/orders/order/{id}/assign-driver/", h.AssignDriver)
	r.Patch("/api/orders/order/{id}/status/", h.UpdateStatus)
	r.Get("/api/orders/admin/analytics/", h.AdminAnalytics)
	r.Get("/api/orders/admin/order/{id}/", h.AdminOrderDetail)
	r.Get("/api/orders/admin/search/", h.AdminSearchOrders)
	r.Patch("/api/orders/admin/order/{id}/override-status/", h.AdminOverrideStatus)
	r.Get("/api/orders/admin/live-stats/", h.AdminLiveStats)
	r.Get("/api/orders/admin/hourly/", h.AdminHourlyOrders)

	// Authenticated endpoints
	r.Group(func(r chi.Router) {
		r.Use(auth.JWTMiddleware(cfg.SecretKey))
		r.Post("/api/orders/create/", h.CreateOrder)
		r.Get("/api/orders/list/", h.ListOrders)
		r.Post("/api/orders/cancel/{id}/", h.CancelOrder)
	})

	port := os.Getenv("ORDER_PORT")
	if port == "" {
		port = "8003"
	}

	srv := &http.Server{Addr: ":" + port, Handler: r}

	go func() {
		log.Printf("[server] order service listening on :%s", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("[server] listen error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("[server] shutting down...")

	// Stop the scheduled-order dispatcher goroutine first
	schedulerCancel()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	srv.Shutdown(ctx)
}
