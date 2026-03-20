package config

import (
	"os"
	"strings"
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

	// Inter-service TLS: when true, ServiceURL() returns https:// URLs
	ServiceTLSEnabled bool

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

		// SERVICE_TLS_ENABLED controls whether inter-service calls use https.
		// Set to "true" in production (e.g. when services communicate over a
		// TLS-terminated mesh or through an ALB with HTTPS listeners).
		ServiceTLSEnabled: strings.EqualFold(envOrDefault("SERVICE_TLS_ENABLED", "false"), "true"),

		GoogleAPIKey:   envOrDefault("GOOGLE_API_KEY", ""),
		SendgridAPIKey: envOrDefault("SENDGRID_API_KEY", ""),
	}
}

// DatabaseURL builds a PostgreSQL connection string for the given database name.
func (c *Config) DatabaseURL(dbName string) string {
	return "postgres://" + c.PostgresUser + ":" + c.PostgresPassword +
		"@" + c.PostgresHost + ":" + c.PostgresPort + "/" + dbName + "?sslmode=disable"
}

// ServiceURL returns the full base URL for a named service, respecting the
// ServiceTLSEnabled flag.  Supported service names: "auth", "restaurant",
// "order", "driver", "payment".  If TLS is enabled, any http:// prefix in
// the configured URL is upgraded to https://.
func (c *Config) ServiceURL(service string) string {
	var raw string
	switch strings.ToLower(service) {
	case "auth":
		raw = c.AuthServiceURL
	case "restaurant":
		raw = c.RestaurantServiceURL
	case "order":
		raw = c.OrderServiceURL
	case "driver":
		raw = c.DriverServiceURL
	case "payment":
		raw = c.PaymentServiceURL
	default:
		return ""
	}

	// When TLS is enabled, upgrade http:// to https://
	if c.ServiceTLSEnabled && strings.HasPrefix(raw, "http://") {
		raw = "https://" + strings.TrimPrefix(raw, "http://")
	}
	return raw
}

func envOrDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
