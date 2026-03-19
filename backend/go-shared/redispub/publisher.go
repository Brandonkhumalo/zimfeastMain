package redispub

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

type Publisher struct {
	client *redis.Client
}

func New(redisURL string) *Publisher {
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Printf("[redis] failed to parse URL: %v", err)
		opts = &redis.Options{Addr: "localhost:6379"}
	}

	client := redis.NewClient(opts)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Printf("[redis] connection failed: %v (will retry on publish)", err)
	} else {
		log.Println("[redis] connected")
	}

	return &Publisher{client: client}
}

func (p *Publisher) Client() *redis.Client {
	return p.client
}

func (p *Publisher) Publish(ctx context.Context, channel string, data interface{}) error {
	payload, err := json.Marshal(data)
	if err != nil {
		return err
	}
	if err := p.client.Publish(ctx, channel, payload).Err(); err != nil {
		log.Printf("[redis] publish to %s failed: %v", channel, err)
		return err
	}
	return nil
}

func (p *Publisher) PublishOrderStatus(ctx context.Context, orderID, status string) error {
	return p.Publish(ctx, "orders.status.changed", map[string]string{
		"orderId": orderID,
		"status":  status,
	})
}

func (p *Publisher) Subscribe(ctx context.Context, channels ...string) *redis.PubSub {
	return p.client.Subscribe(ctx, channels...)
}

func (p *Publisher) Close() error {
	return p.client.Close()
}
