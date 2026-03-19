package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const UserContextKey contextKey = "jwt_user"

type JWTUser struct {
	ID        string `json:"id"`
	Role      string `json:"role"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

func (u *JWTUser) FullName() string {
	return strings.TrimSpace(u.FirstName + " " + u.LastName)
}

func UserFromContext(ctx context.Context) *JWTUser {
	u, _ := ctx.Value(UserContextKey).(*JWTUser)
	return u
}

func JWTMiddleware(secretKey string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, `{"detail":"Authentication credentials were not provided."}`, http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
				if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
				}
				return []byte(secretKey), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, `{"detail":"Invalid or expired token."}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"detail":"Invalid token claims."}`, http.StatusUnauthorized)
				return
			}

			user := &JWTUser{
				ID:        getClaimString(claims, "user_id"),
				Role:      getClaimString(claims, "role"),
				Email:     getClaimString(claims, "email"),
				FirstName: getClaimString(claims, "first_name"),
				LastName:  getClaimString(claims, "last_name"),
			}
			if user.ID == "" {
				user.ID = getClaimString(claims, "id")
			}

			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// ValidateToken validates a JWT token string and returns the user, without HTTP context
func ValidateToken(tokenStr, secretKey string) (*JWTUser, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return []byte(secretKey), nil
	})
	if err != nil || !token.Valid {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid claims")
	}

	user := &JWTUser{
		ID:        getClaimString(claims, "user_id"),
		Role:      getClaimString(claims, "role"),
		Email:     getClaimString(claims, "email"),
		FirstName: getClaimString(claims, "first_name"),
		LastName:  getClaimString(claims, "last_name"),
	}
	if user.ID == "" {
		user.ID = getClaimString(claims, "id")
	}
	return user, nil
}

func getClaimString(claims jwt.MapClaims, key string) string {
	if v, ok := claims[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}
