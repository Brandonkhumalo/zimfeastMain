"""
Basic fraud detection for payment-service.
Uses Redis TTL-based counters to detect suspicious payment patterns,
promo abuse, and velocity anomalies.
"""
import logging
import redis
import os

logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379')
_redis = None


def _get_redis():
    global _redis
    if _redis is None:
        _redis = redis.from_url(REDIS_URL, decode_responses=True)
    return _redis


def check_payment_pattern(customer_id):
    """
    Check if a customer has had multiple failed payments recently.
    Returns a fraud signal dict if suspicious, None otherwise.
    """
    try:
        r = _get_redis()
        key = f"fraud:pay_fails:{customer_id}"
        count = r.get(key)
        if count and int(count) >= 3:
            return {
                "type": "payment_pattern",
                "message": f"Customer had {count} failed payments before this success",
                "score": 2,
            }
    except Exception as e:
        logger.warning(f"Fraud check failed: {e}")
    return None


def record_payment_failure(customer_id):
    """Record a failed payment attempt for a customer."""
    try:
        r = _get_redis()
        key = f"fraud:pay_fails:{customer_id}"
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, 3600)  # 1 hour TTL
        pipe.execute()
    except Exception as e:
        logger.warning(f"Failed to record payment failure: {e}")


def record_payment_success(customer_id):
    """Clear the failed payment counter on successful payment."""
    try:
        r = _get_redis()
        key = f"fraud:pay_fails:{customer_id}"
        r.delete(key)
    except Exception as e:
        logger.warning(f"Failed to clear payment failure counter: {e}")


def check_promo_abuse(promo_code, customer_ip):
    """
    Check if the same promo code has been attempted multiple times from
    the same IP address (potential multi-account promo abuse).
    """
    if not promo_code or not customer_ip:
        return None
    try:
        r = _get_redis()
        key = f"fraud:promo:{promo_code}:{customer_ip}"
        count = r.get(key)
        if count and int(count) >= 3:
            return {
                "type": "promo_abuse",
                "message": f"Promo code {promo_code} attempted {count} times from same IP",
                "score": 3,
            }
    except Exception as e:
        logger.warning(f"Promo abuse check failed: {e}")
    return None


def record_promo_attempt(promo_code, customer_ip):
    """Record a promo code usage attempt from an IP."""
    if not promo_code or not customer_ip:
        return
    try:
        r = _get_redis()
        key = f"fraud:promo:{promo_code}:{customer_ip}"
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, 86400)  # 24 hour TTL
        pipe.execute()
    except Exception as e:
        logger.warning(f"Failed to record promo attempt: {e}")


def publish_fraud_alert(customer_id, order_id, signals):
    """Publish a fraud alert to Redis for admin notification."""
    if not signals:
        return
    try:
        import json
        r = _get_redis()
        r.publish("orders.fraud.flagged", json.dumps({
            "orderId": str(order_id),
            "customerId": str(customer_id),
            "signals": signals,
        }))
    except Exception as e:
        logger.warning(f"Failed to publish fraud alert: {e}")
