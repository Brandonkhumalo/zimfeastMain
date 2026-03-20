package redispub

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// Publisher wraps a Redis client and provides both traditional pub/sub
// and Redis Streams methods for durable message delivery.
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

// ─── Traditional Pub/Sub ─────────────────────────────────────────────

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

// ─── Redis Streams (durable message delivery) ────────────────────────

// PublishToStream writes data to a Redis Stream using XADD.  Unlike pub/sub,
// stream messages are persisted and can be consumed by consumer groups even if
// the consumer was offline when the message was published.
// Returns the auto-generated message ID (e.g. "1679012345678-0").
func (p *Publisher) PublishToStream(ctx context.Context, stream string, data interface{}) (string, error) {
	payload, err := json.Marshal(data)
	if err != nil {
		return "", fmt.Errorf("marshal stream payload: %w", err)
	}
	id, err := p.client.XAdd(ctx, &redis.XAddArgs{
		Stream: stream,
		Values: map[string]interface{}{"data": string(payload)},
	}).Result()
	if err != nil {
		log.Printf("[redis] XADD to stream %s failed: %v", stream, err)
		return "", err
	}
	return id, nil
}

// ReadStream reads messages from a Redis Stream starting at the given ID.
// Pass "0" to read from the beginning, or "$" to read only new messages.
// count controls the maximum number of messages returned (0 = no limit).
func (p *Publisher) ReadStream(ctx context.Context, stream string, startID string, count int64) ([]redis.XMessage, error) {
	args := &redis.XReadArgs{
		Streams: []string{stream, startID},
		Block:   0, // non-blocking
	}
	if count > 0 {
		args.Count = count
	}
	results, err := p.client.XRead(ctx, args).Result()
	if err != nil {
		return nil, fmt.Errorf("XREAD from stream %s: %w", stream, err)
	}
	// XRead returns a slice of XStream (one per stream name requested).
	// We only requested one stream, so return its messages directly.
	if len(results) == 0 {
		return nil, nil
	}
	return results[0].Messages, nil
}

// ReadStreamGroup reads messages for a consumer group.  Use ">" as startID
// to receive only messages that have not been delivered to any consumer in
// the group yet.
func (p *Publisher) ReadStreamGroup(ctx context.Context, group, consumer, stream string, count int64, block time.Duration) ([]redis.XMessage, error) {
	args := &redis.XReadGroupArgs{
		Group:    group,
		Consumer: consumer,
		Streams:  []string{stream, ">"},
		Block:    block,
		NoAck:    false, // require explicit ACK
	}
	if count > 0 {
		args.Count = count
	}
	results, err := p.client.XReadGroup(ctx, args).Result()
	if err != nil {
		// redis.Nil means no new messages within the block timeout — not an error.
		if err == redis.Nil {
			return nil, nil
		}
		return nil, fmt.Errorf("XREADGROUP %s/%s from stream %s: %w", group, consumer, stream, err)
	}
	if len(results) == 0 {
		return nil, nil
	}
	return results[0].Messages, nil
}

// AckStream acknowledges one or more messages in a consumer group so they
// are no longer in the Pending Entries List (PEL).
func (p *Publisher) AckStream(ctx context.Context, stream, group string, ids ...string) error {
	return p.client.XAck(ctx, stream, group, ids...).Err()
}

// CreateConsumerGroup creates a consumer group on the given stream.
// startID controls which messages the group will receive:
//   - "0" = all existing + new messages
//   - "$" = only new messages published after group creation
//
// If the group already exists the error is silently ignored.
func (p *Publisher) CreateConsumerGroup(ctx context.Context, stream, group, startID string) error {
	err := p.client.XGroupCreateMkStream(ctx, stream, group, startID).Err()
	if err != nil {
		// "BUSYGROUP Consumer Group name already exists" is not a real error
		// — it just means the group was already created (idempotent setup).
		if isConsumerGroupExistsErr(err) {
			log.Printf("[redis] consumer group %s already exists on stream %s", group, stream)
			return nil
		}
		return fmt.Errorf("XGROUP CREATE %s on stream %s: %w", group, stream, err)
	}
	log.Printf("[redis] created consumer group %s on stream %s (start=%s)", group, stream, startID)
	return nil
}

// ─── Durable Order Status (Stream + Pub/Sub) ─────────────────────────

// PublishOrderStatusDurable writes the order status change to BOTH a Redis
// Stream (for durable, replayable consumption by consumer groups) AND the
// traditional pub/sub channel (for backward compatibility with existing
// real-time consumers like the WebSocket service).
//
// The stream name is "stream:orders.status.changed" to clearly differentiate
// it from the pub/sub channel "orders.status.changed".
func (p *Publisher) PublishOrderStatusDurable(ctx context.Context, orderID, status string) error {
	data := map[string]string{
		"orderId": orderID,
		"status":  status,
	}

	// 1. Write to the durable stream first (most important for consistency).
	streamName := "stream:orders.status.changed"
	msgID, err := p.PublishToStream(ctx, streamName, data)
	if err != nil {
		log.Printf("[redis] durable stream write failed for order %s: %v", orderID, err)
		return fmt.Errorf("stream publish for order %s: %w", orderID, err)
	}
	log.Printf("[redis] order %s status=%s written to stream (id=%s)", orderID, status, msgID)

	// 2. Also publish to pub/sub for backward compatibility (best-effort).
	if pubErr := p.Publish(ctx, "orders.status.changed", data); pubErr != nil {
		// Log but do NOT return an error — the stream write succeeded which is
		// the durable source of truth.  Existing pub/sub consumers will
		// eventually be migrated to read from the stream.
		log.Printf("[redis] pub/sub publish for order %s failed (non-fatal): %v", orderID, pubErr)
	}

	return nil
}

// ─── Helpers ─────────────────────────────────────────────────────────

func (p *Publisher) Close() error {
	return p.client.Close()
}

// isConsumerGroupExistsErr checks whether the error from XGROUP CREATE
// indicates the group already exists.
func isConsumerGroupExistsErr(err error) bool {
	if err == nil {
		return false
	}
	return contains(err.Error(), "BUSYGROUP")
}

// contains is a simple substring check (avoids importing strings).
func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchSubstring(s, substr)
}

func searchSubstring(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
