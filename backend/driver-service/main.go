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

	"zimfeast/driver/internal/handlers"
)

func main() {
	cfg := config.Load()

	dbName := os.Getenv("DRIVER_DB_NAME")
	if dbName == "" {
		dbName = "zimfeast_drivers"
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

	r.Get("/api/drivers/health/", h.AdminHealthCheck)

	// Admin endpoints (public, admin auth handled by frontend)
	r.Get("/api/drivers/admin/list/", h.AdminListDrivers)
	r.Get("/api/drivers/admin/driver/{id}/detail/", h.AdminDriverDetail)

	r.Group(func(r chi.Router) {
		r.Use(auth.JWTMiddleware(cfg.SecretKey))

		r.Post("/api/drivers/profile/create/", h.CreateProfile)
		r.Put("/api/drivers/status/toggle/", h.ToggleStatus)
		r.Get("/api/drivers/status/", h.GetStatus)
		r.Post("/api/drivers/order/{pk}/reject/", h.RejectOrder)
		r.Post("/api/drivers/location/update/", h.UpdateLocation)
		r.Post("/api/drivers/order/{orderId}/cancel/", h.CancelOrder)
		r.Get("/api/drivers/active/orders/", h.ActiveOrders)
		r.Get("/api/drivers/orders/history/", h.OrderHistory)
		r.Get("/api/drivers/daily/finances/", h.GetFinance)
		r.Post("/api/drivers/daily/finances/", h.UpdateFinance)
		r.Post("/api/drivers/rate/driver/", h.SubmitRating)
		r.Get("/api/drivers/ratings/recent/", h.GetRecentRatings)
	})

	port := os.Getenv("DRIVER_PORT")
	if port == "" {
		port = "8004"
	}

	srv := &http.Server{Addr: ":" + port, Handler: r}

	go func() {
		log.Printf("[server] driver service listening on :%s", port)
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
