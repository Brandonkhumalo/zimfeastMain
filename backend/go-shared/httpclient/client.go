package httpclient

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

var httpClient = &http.Client{Timeout: 10 * time.Second}

type ServiceURLs struct {
	Auth       string
	Restaurant string
	Order      string
	Driver     string
	Payment    string
}

type Client struct {
	urls      ServiceURLs
	apiKey    string
}

func New(urls ServiceURLs, apiKey string) *Client {
	return &Client{urls: urls, apiKey: apiKey}
}

func (c *Client) Request(serviceName, method, path string, body interface{}, authToken string) (map[string]interface{}, error) {
	baseURL := c.serviceURL(serviceName)
	if baseURL == "" {
		return nil, fmt.Errorf("unknown service: %s", serviceName)
	}

	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(data)
	}

	req, err := http.NewRequest(method, baseURL+path, bodyReader)
	if err != nil {
		return nil, err
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Service-Key", c.apiKey)
	if authToken != "" {
		req.Header.Set("Authorization", "Bearer "+authToken)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) GetUser(userID string, authToken string) (map[string]interface{}, error) {
	return c.Request("auth", "GET", "/api/internal/user/"+userID+"/", nil, authToken)
}

func (c *Client) GetRestaurant(restaurantID string, authToken string) (map[string]interface{}, error) {
	return c.Request("restaurant", "GET", "/api/internal/restaurant/"+restaurantID+"/", nil, authToken)
}

func (c *Client) serviceURL(name string) string {
	switch name {
	case "auth":
		return c.urls.Auth
	case "restaurant":
		return c.urls.Restaurant
	case "order":
		return c.urls.Order
	case "driver":
		return c.urls.Driver
	case "payment":
		return c.urls.Payment
	default:
		return ""
	}
}
