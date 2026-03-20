package scheduler

import (
	"context"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"zimfeast/shared/redispub"
)

// Scheduler is a background worker that periodically checks for scheduled
// orders whose scheduled_for time has arrived. When a due order is found,
// it transitions the order from "scheduled" to "pending_payment" and publishes
// a Redis event so the customer gets notified to pay.
type Scheduler struct {
	db  *pgxpool.Pool
	pub *redispub.Publisher
}

// New creates a new Scheduler instance.
func New(db *pgxpool.Pool, pub *redispub.Publisher) *Scheduler {
	return &Scheduler{db: db, pub: pub}
}

// Start launches the scheduler loop in a goroutine. The loop runs every 30
// seconds and queries for orders where status = 'scheduled' AND scheduled_for
// is at or before the current time. Each matching order is updated to
// "pending_payment" and a Redis notification is published.
//
// The goroutine respects context cancellation for graceful shutdown.
func (s *Scheduler) Start(ctx context.Context) {
	go s.run(ctx)
}

// run is the internal loop that executes on a 30-second ticker.
func (s *Scheduler) run(ctx context.Context) {
	// Ticker fires every 30 seconds to check for due scheduled orders
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	log.Println("[scheduler] started — checking for due scheduled orders every 30s")

	// Run once immediately on startup, then on every tick
	s.dispatchDueOrders(ctx)

	for {
		select {
		case <-ctx.Done():
			// Context cancelled — the server is shutting down
			log.Println("[scheduler] stopped")
			return
		case <-ticker.C:
			s.dispatchDueOrders(ctx)
		}
	}
}

// dispatchDueOrders queries for scheduled orders that are due (scheduled_for
// is at or before NOW) and transitions each one to pending_payment.
func (s *Scheduler) dispatchDueOrders(ctx context.Context) {
	// Find all orders that are scheduled and whose time has come
	rows, err := s.db.Query(ctx,
		`SELECT id FROM orders_order
		 WHERE status = 'scheduled' AND scheduled_for <= NOW()`)
	if err != nil {
		log.Printf("[scheduler] query error: %v", err)
		return
	}
	defer rows.Close()

	var orderIDs []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			log.Printf("[scheduler] scan error: %v", err)
			continue
		}
		orderIDs = append(orderIDs, id)
	}

	if len(orderIDs) == 0 {
		return // Nothing due
	}

	log.Printf("[scheduler] found %d due scheduled order(s)", len(orderIDs))

	for _, orderID := range orderIDs {
		// Update status from scheduled -> pending_payment
		result, err := s.db.Exec(ctx,
			`UPDATE orders_order SET status = 'pending_payment'
			 WHERE id = $1 AND status = 'scheduled'`, orderID)
		if err != nil {
			log.Printf("[scheduler] failed to update order %s: %v", orderID, err)
			continue
		}

		if result.RowsAffected() == 0 {
			// Order was already transitioned (race condition) — skip
			continue
		}

		log.Printf("[scheduler] order %s transitioned to pending_payment", orderID)

		// Publish a Redis event so the realtime service can notify the customer
		// that it's time to pay for their scheduled order
		if err := s.pub.PublishOrderStatus(ctx, orderID, "pending_payment"); err != nil {
			log.Printf("[scheduler] failed to publish status for order %s: %v", orderID, err)
		}
	}
}
