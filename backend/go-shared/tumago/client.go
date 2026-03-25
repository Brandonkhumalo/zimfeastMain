package tumago

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"
)

// ─── Request / Response Structs ──────────────────────────────────────

// DeliveryRequest is the body sent to POST /partner/delivery/request/
type DeliveryRequest struct {
	OriginLat          float64 `json:"origin_lat"`
	OriginLng          float64 `json:"origin_lng"`
	DestinationLat     float64 `json:"destination_lat"`
	DestinationLng     float64 `json:"destination_lng"`
	Vehicle            string  `json:"vehicle"`
	Fare               float64 `json:"fare"`
	PartnerReference   string  `json:"partner_reference"`
	PickupContact      string  `json:"pickup_contact"`
	DropoffContact     string  `json:"dropoff_contact"`
	PackageDescription string  `json:"package_description"`
}

// DeliveryResponse matches TumaGo's POST /partner/delivery/request/ response:
//   {"id": "<uuid>", "partner_reference": "...", "status": "matching", "trip_id": "<uuid>"}
type DeliveryResponse struct {
	ID               string `json:"id"`                // PartnerDeliveryRequest UUID
	PartnerReference string `json:"partner_reference"`
	Status           string `json:"status"`
	TripID           string `json:"trip_id"`
}

// DeliveryStatus matches TumaGo's GET /partner/delivery/{id}/status/ response.
// Driver and vehicle info are nested objects, not flat fields.
type DeliveryStatus struct {
	ID               string                 `json:"id"`
	PartnerReference string                 `json:"partner_reference"`
	Status           string                 `json:"status"`
	CreatedAt        string                 `json:"created_at,omitempty"`
	Origin           *LatLng                `json:"origin,omitempty"`
	Destination      *LatLng                `json:"destination,omitempty"`
	Fare             float64                `json:"fare,omitempty"`
	Driver           *DriverInfo            `json:"driver,omitempty"`
	Vehicle          map[string]interface{} `json:"vehicle,omitempty"`
	DriverLocation   *LatLng                `json:"driver_location,omitempty"`
	CompletedAt      string                 `json:"completed_at,omitempty"`
}

type LatLng struct {
	Lat float64 `json:"lat"`
	Lng float64 `json:"lng"`
}

type DriverInfo struct {
	Name   string  `json:"name"`
	Phone  string  `json:"phone"`
	Rating float64 `json:"rating"`
}

// BalanceResponse matches TumaGo's GET /partner/balance/ response.
type BalanceResponse struct {
	Balance        float64 `json:"balance"`
	SetupFeePaid   bool    `json:"setup_fee_paid"`
	CommissionRate float64 `json:"commission_rate"`
}

// WebhookPayload matches TumaGo's webhook POST body.
// TumaGo sends nested driver/vehicle objects and driver_location for location events.
//
// Example driver_assigned payload:
//
//	{"event":"driver_assigned","partner_reference":"...","delivery_id":"...",
//	 "timestamp":"...","driver":{"name":"...","phone":"...","rating":4.5},
//	 "vehicle":{"type":"...","name":"...","color":"...","number_plate":"...","model":"..."}}
//
// Example location_update payload:
//
//	{"event":"location_update","partner_reference":"...","delivery_id":"...",
//	 "driver_location":{"lat":-17.8,"lng":31.0}}
type WebhookPayload struct {
	Event            string                 `json:"event"`
	DeliveryID       string                 `json:"delivery_id"`
	PartnerReference string                 `json:"partner_reference"`
	Timestamp        string                 `json:"timestamp,omitempty"`
	Driver           *DriverInfo            `json:"driver,omitempty"`
	Vehicle          map[string]interface{} `json:"vehicle,omitempty"`
	DriverLocation   *LatLng                `json:"driver_location,omitempty"`
	CompletedAt      string                 `json:"completed_at,omitempty"`
	Fare             float64                `json:"fare,omitempty"`
	Reason           string                 `json:"reason,omitempty"`
}

// ─── Client ──────────────────────────────────────────────────────────

// Client is an HTTP client for calling TumaGo's Partner API.
type Client struct {
	baseURL   string
	apiKey    string
	apiSecret string
	http      *http.Client
}

// NewClient creates a new TumaGo API client, reading configuration from
// environment variables:
//   - TUMAGO_API_URL   (default: https://tumago.co.zw/api/v1)
//   - TUMAGO_API_KEY   (sent as X-API-Key header)
//   - TUMAGO_API_SECRET (used for verifying webhook signatures)
func NewClient() *Client {
	baseURL := os.Getenv("TUMAGO_API_URL")
	if baseURL == "" {
		baseURL = "https://tumago.co.zw/api/v1"
	}

	apiKey := os.Getenv("TUMAGO_API_KEY")
	apiSecret := os.Getenv("TUMAGO_API_SECRET")

	if apiKey == "" {
		log.Println("[tumago] WARNING: TUMAGO_API_KEY is not set")
	}
	if apiSecret == "" {
		log.Println("[tumago] WARNING: TUMAGO_API_SECRET is not set")
	}

	return &Client{
		baseURL:   baseURL,
		apiKey:    apiKey,
		apiSecret: apiSecret,
		http:      &http.Client{Timeout: 15 * time.Second},
	}
}

// RequestDelivery calls POST /partner/delivery/request/ to create a new
// delivery via TumaGo. Returns the delivery ID and initial status.
func (c *Client) RequestDelivery(req DeliveryRequest) (*DeliveryResponse, error) {
	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("marshal delivery request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.baseURL+"/partner/delivery/request/", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	c.setHeaders(httpReq)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("tumago request delivery: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("tumago request delivery failed (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var result DeliveryResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("decode delivery response: %w", err)
	}
	return &result, nil
}

// GetDeliveryStatus calls GET /partner/delivery/{deliveryID}/status/ to
// retrieve the current status of a TumaGo delivery.
func (c *Client) GetDeliveryStatus(deliveryID string) (*DeliveryStatus, error) {
	url := fmt.Sprintf("%s/partner/delivery/%s/status/", c.baseURL, deliveryID)
	httpReq, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	c.setHeaders(httpReq)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("tumago get delivery status: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("tumago get delivery status failed (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var result DeliveryStatus
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("decode delivery status: %w", err)
	}
	return &result, nil
}

// CancelDelivery calls POST /partner/delivery/{deliveryID}/cancel/ to cancel
// an active TumaGo delivery.
func (c *Client) CancelDelivery(deliveryID string) error {
	url := fmt.Sprintf("%s/partner/delivery/%s/cancel/", c.baseURL, deliveryID)
	httpReq, err := http.NewRequest("POST", url, nil)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	c.setHeaders(httpReq)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return fmt.Errorf("tumago cancel delivery: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("tumago cancel delivery failed (HTTP %d): %s", resp.StatusCode, string(respBody))
	}
	return nil
}

// GetBalance calls GET /partner/balance/ to retrieve the partner's current
// account balance with TumaGo.
func (c *Client) GetBalance() (*BalanceResponse, error) {
	httpReq, err := http.NewRequest("GET", c.baseURL+"/partner/balance/", nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	c.setHeaders(httpReq)

	resp, err := c.http.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("tumago get balance: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response body: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("tumago get balance failed (HTTP %d): %s", resp.StatusCode, string(respBody))
	}

	var result BalanceResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("decode balance response: %w", err)
	}
	return &result, nil
}

// VerifyWebhookSignature checks whether the HMAC-SHA256 signature of the
// webhook body matches the provided signature. The signature is computed
// using the API secret as the HMAC key.
func (c *Client) VerifyWebhookSignature(body []byte, signature string) bool {
	if c.apiSecret == "" {
		log.Println("[tumago] WARNING: cannot verify webhook — TUMAGO_API_SECRET is not set")
		return false
	}

	mac := hmac.New(sha256.New, []byte(c.apiSecret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))

	return hmac.Equal([]byte(expected), []byte(signature))
}

// ─── Helpers ─────────────────────────────────────────────────────────

// setHeaders adds the common headers required by TumaGo's Partner API.
func (c *Client) setHeaders(req *http.Request) {
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-API-Key", c.apiKey)
}
