package handlers

import (
	"testing"
)

// TestIsValidTransition_AllValidPaths verifies every explicitly defined
// valid transition in the validTransitions map returns true.
func TestIsValidTransition_AllValidPaths(t *testing.T) {
	// Each entry: {from, to, description}
	validCases := []struct {
		from string
		to   string
		desc string
	}{
		// pending_payment can go to paid or cancelled
		{"pending_payment", "paid", "pending_payment -> paid"},
		{"pending_payment", "cancelled", "pending_payment -> cancelled"},
		// paid can go to preparing or cancelled
		{"paid", "preparing", "paid -> preparing"},
		{"paid", "cancelled", "paid -> cancelled"},
		// preparing can go to ready
		{"preparing", "ready", "preparing -> ready"},
		// ready can go to collected
		{"ready", "collected", "ready -> collected"},
		// collected can go to assigned
		{"collected", "assigned", "collected -> assigned"},
		// assigned can go to out_for_delivery
		{"assigned", "out_for_delivery", "assigned -> out_for_delivery"},
		// out_for_delivery can go to delivered
		{"out_for_delivery", "delivered", "out_for_delivery -> delivered"},
	}

	for _, tc := range validCases {
		t.Run(tc.desc, func(t *testing.T) {
			if !isValidTransition(tc.from, tc.to) {
				t.Errorf("isValidTransition(%q, %q) = false; want true", tc.from, tc.to)
			}
		})
	}
}

// TestIsValidTransition_RejectsInvalidPaths verifies that transitions
// not in the state machine are correctly rejected.
func TestIsValidTransition_RejectsInvalidPaths(t *testing.T) {
	invalidCases := []struct {
		from string
		to   string
		desc string
	}{
		// Skip states: cannot jump from beginning to end
		{"pending_payment", "delivered", "skip: pending_payment -> delivered"},
		{"pending_payment", "preparing", "skip: pending_payment -> preparing"},
		{"pending_payment", "ready", "skip: pending_payment -> ready"},
		{"pending_payment", "out_for_delivery", "skip: pending_payment -> out_for_delivery"},

		// Backwards transitions: cannot go back in the pipeline
		{"paid", "pending_payment", "backward: paid -> pending_payment"},
		{"preparing", "paid", "backward: preparing -> paid"},
		{"ready", "preparing", "backward: ready -> preparing"},
		{"delivered", "out_for_delivery", "backward: delivered -> out_for_delivery"},

		// Preparing cannot be cancelled (only pending_payment and paid can)
		{"preparing", "cancelled", "preparing -> cancelled not allowed"},

		// Terminal state: delivered has no outgoing transitions
		{"delivered", "pending_payment", "terminal: delivered -> pending_payment"},
		{"delivered", "paid", "terminal: delivered -> paid"},

		// Unknown/nonexistent states
		{"nonexistent", "paid", "unknown source state"},
		{"pending_payment", "nonexistent", "unknown target state"},
		{"", "paid", "empty source state"},
		{"paid", "", "empty target state"},

		// Self-transitions should not be allowed
		{"pending_payment", "pending_payment", "self: pending_payment -> pending_payment"},
		{"paid", "paid", "self: paid -> paid"},
		{"preparing", "preparing", "self: preparing -> preparing"},
		{"delivered", "delivered", "self: delivered -> delivered"},

		// assigned cannot go backwards or skip
		{"assigned", "collected", "backward: assigned -> collected"},
		{"assigned", "delivered", "skip: assigned -> delivered"},
		{"assigned", "preparing", "skip: assigned -> preparing"},

		// out_for_delivery can only go to delivered
		{"out_for_delivery", "assigned", "backward: out_for_delivery -> assigned"},
		{"out_for_delivery", "cancelled", "out_for_delivery -> cancelled not allowed"},
	}

	for _, tc := range invalidCases {
		t.Run(tc.desc, func(t *testing.T) {
			if isValidTransition(tc.from, tc.to) {
				t.Errorf("isValidTransition(%q, %q) = true; want false", tc.from, tc.to)
			}
		})
	}
}

// TestValidTransitions_CoversAllExpectedStatuses ensures the
// validTransitions map has entries for every expected non-terminal status.
func TestValidTransitions_CoversAllExpectedStatuses(t *testing.T) {
	// These are all statuses that should have outgoing transitions.
	// "delivered" and "cancelled" are terminal states and should NOT
	// appear as keys in validTransitions.
	expectedStatuses := []string{
		"pending_payment",
		"paid",
		"preparing",
		"ready",
		"collected",
		"assigned",
		"out_for_delivery",
	}

	for _, s := range expectedStatuses {
		t.Run("has_transitions_for_"+s, func(t *testing.T) {
			transitions, ok := validTransitions[s]
			if !ok {
				t.Errorf("validTransitions missing key %q", s)
				return
			}
			if len(transitions) == 0 {
				t.Errorf("validTransitions[%q] is empty; expected at least one target", s)
			}
		})
	}
}

// TestValidTransitions_TerminalStatesHaveNoOutgoing ensures that
// terminal states (delivered, cancelled) are NOT keys in validTransitions,
// meaning nothing can transition out of them.
func TestValidTransitions_TerminalStatesHaveNoOutgoing(t *testing.T) {
	terminalStates := []string{"delivered", "cancelled"}

	for _, s := range terminalStates {
		t.Run("no_transitions_from_"+s, func(t *testing.T) {
			if _, ok := validTransitions[s]; ok {
				t.Errorf("validTransitions should NOT have key %q (terminal state)", s)
			}
		})
	}
}

// TestValidTransitions_NoDuplicateTargets checks that no status has
// duplicate entries in its list of allowed target statuses.
func TestValidTransitions_NoDuplicateTargets(t *testing.T) {
	for from, targets := range validTransitions {
		t.Run("no_duplicates_for_"+from, func(t *testing.T) {
			seen := make(map[string]bool)
			for _, target := range targets {
				if seen[target] {
					t.Errorf("validTransitions[%q] has duplicate target %q", from, target)
				}
				seen[target] = true
			}
		})
	}
}

// TestIsValidTransition_FullPipelineWalkthrough simulates a complete
// order lifecycle from pending_payment to delivered, verifying each
// step is a valid transition.
func TestIsValidTransition_FullPipelineWalkthrough(t *testing.T) {
	pipeline := []string{
		"pending_payment",
		"paid",
		"preparing",
		"ready",
		"collected",
		"assigned",
		"out_for_delivery",
		"delivered",
	}

	for i := 0; i < len(pipeline)-1; i++ {
		from := pipeline[i]
		to := pipeline[i+1]
		t.Run(from+"->"+to, func(t *testing.T) {
			if !isValidTransition(from, to) {
				t.Errorf("Full pipeline step isValidTransition(%q, %q) = false; want true", from, to)
			}
		})
	}
}
