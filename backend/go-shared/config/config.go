package config

import (
	"os"
)

type Config struct {
	SecretKey    string
	RedisURL     string
	Debug        bool

	// Database
	PostgresUser     string
	PostgresPassword string
	PostgresHost     string
	PostgresPort     string

	// Service URLs
	AuthServiceURL       string
	RestaurantServiceURL string
	OrderServiceURL      string
	DriverServiceURL     string
	PaymentServiceURL    string
	ServiceAPIKey        string

	// APIs
	GoogleAPIKey   string
	SendgridAPIKey string
}

func Load() *Config {
	return &Config{
		SecretKey:    envOrDefault("SECRET_KEY", envOrDefault("JWT_SECRET_KEY", "dev-secret")),
		RedisURL:     envOrDefault("REDIS_URL", "redis://localhost:6379"),
		Debug:        envOrDefault("DEBUG", "False") == "True",

		PostgresUser:     envOrDefault("POSTGRES_USER", "zimfeast"),
		PostgresPassword: envOrDefault("POSTGRES_PASSWORD", "postgres"),
		PostgresHost:     envOrDefault("POSTGRES_HOST", "localhost"),
		PostgresPort:     envOrDefault("POSTGRES_PORT", "5432"),

		AuthServiceURL:       envOrDefault("AUTH_SERVICE_URL", "http://auth-service:8001"),
		RestaurantServiceURL: envOrDefault("RESTAURANT_SERVICE_URL", "http://restaurant-service:8002"),
		OrderServiceURL:      envOrDefault("ORDER_SERVICE_URL", "http://order-service:8003"),
		DriverServiceURL:     envOrDefault("DRIVER_SERVICE_URL", "http://driver-service:8004"),
		PaymentServiceURL:    envOrDefault("PAYMENT_SERVICE_URL", "http://payment-service:8005"),
		ServiceAPIKey:        envOrDefault("SERVICE_API_KEY", ""),

		GoogleAPIKey:   envOrDefault("GOOGLE_API_KEY", ""),
		SendgridAPIKey: envOrDefault("SENDGRID_API_KEY", ""),
	}
}

func (c *Config) DatabaseURL(dbName string) string {
	return "postgres://" + c.PostgresUser + ":" + c.PostgresPassword +
		"@" + c.PostgresHost + ":" + c.PostgresPort + "/" + dbName + "?sslmode=disable"
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
