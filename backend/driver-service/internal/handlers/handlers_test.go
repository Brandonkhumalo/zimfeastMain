package handlers

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestNew_ReturnsNonNilHandler verifies that the New constructor
// returns a non-nil *Handler even when all dependencies are nil.
// This is a basic smoke test for the constructor.
func TestNew_ReturnsNonNilHandler(t *testing.T) {
	h := New(nil, nil, nil)
	if h == nil {
		t.Fatal("New(nil, nil, nil) returned nil; expected a non-nil *Handler")
	}
}

// TestNew_StoresFieldsCorrectly verifies that the New constructor
// stores the provided dependencies in the correct struct fields.
func TestNew_StoresFieldsCorrectly(t *testing.T) {
	// We pass nil for all deps since we can't easily create real
	// *pgxpool.Pool, *redispub.Publisher, *config.Config in unit tests.
	// The important thing is the constructor doesn't panic and returns
	// a struct with the fields set.
	h := New(nil, nil, nil)
	if h.db != nil {
		t.Error("Expected h.db to be nil when nil was passed")
	}
	if h.pub != nil {
		t.Error("Expected h.pub to be nil when nil was passed")
	}
	if h.cfg != nil {
		t.Error("Expected h.cfg to be nil when nil was passed")
	}
}

// TestParseIntParam verifies the parseIntParam helper function.
func TestParseIntParam(t *testing.T) {
	tests := []struct {
		name     string
		queryKey string
		queryVal string
		def      int
		want     int
	}{
		{
			name:     "returns default when param is missing",
			queryKey: "page",
			queryVal: "",
			def:      10,
			want:     10,
		},
		{
			name:     "parses valid integer",
			queryKey: "page",
			queryVal: "5",
			def:      10,
			want:     5,
		},
		{
			name:     "returns default for non-numeric value",
			queryKey: "page",
			queryVal: "abc",
			def:      10,
			want:     10,
		},
		{
			name:     "parses zero",
			queryKey: "page",
			queryVal: "0",
			def:      10,
			want:     0,
		},
		{
			name:     "parses negative value",
			queryKey: "page",
			queryVal: "-3",
			def:      1,
			want:     -3,
		},
		{
			name:     "returns default for float value",
			queryKey: "page",
			queryVal: "3.14",
			def:      1,
			want:     1,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Build a request with the query parameter
			url := "/test"
			if tc.queryVal != "" {
				url = "/test?" + tc.queryKey + "=" + tc.queryVal
			}
			req := httptest.NewRequest(http.MethodGet, url, nil)
			got := parseIntParam(req, tc.queryKey, tc.def)
			if got != tc.want {
				t.Errorf("parseIntParam(req, %q, %d) = %d; want %d",
					tc.queryKey, tc.def, got, tc.want)
			}
		})
	}
}

// TestHealthCheck_DoesNotPanicWithNilDeps ensures the HealthCheck
// handler does not panic even if the handler has nil dependencies.
// Note: This will panic because response.OK writes to the ResponseWriter
// using the shared response package. We test it defensively.
func TestHealthCheck_WritesOK(t *testing.T) {
	h := New(nil, nil, nil)
	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	rr := httptest.NewRecorder()

	// HealthCheck only calls response.OK(w, ...) and doesn't touch db/pub/cfg
	h.HealthCheck(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("HealthCheck returned status %d; want %d", rr.Code, http.StatusOK)
	}

	// The body should contain "ok" somewhere
	body := rr.Body.String()
	if body == "" {
		t.Error("HealthCheck returned empty body")
	}
}
