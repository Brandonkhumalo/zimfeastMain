from datetime import timedelta

from django.db.models import Avg, Count, Sum, F, Value, CharField
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import Order


@api_view(["GET"])
@permission_classes([AllowAny])
def admin_analytics(request):
    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=7)
    month_start = today_start - timedelta(days=30)

    # ---------- Helper ----------
    def period_stats(qs):
        agg = qs.aggregate(
            count=Count("id"),
            revenue=Sum("total_fee"),
            avg_order=Avg("total_fee"),
        )
        return {
            "orders": agg["count"] or 0,
            "revenue": float(agg["revenue"] or 0),
            "avg_order_value": round(float(agg["avg_order"] or 0), 2),
        }

    today_qs = Order.objects.filter(created__gte=today_start)
    week_qs = Order.objects.filter(created__gte=week_start)
    month_qs = Order.objects.filter(created__gte=month_start)

    # ---------- All time ----------
    all_time_agg = Order.objects.aggregate(
        count=Count("id"),
        revenue=Sum("total_fee"),
    )

    # ---------- Status breakdown ----------
    status_breakdown = dict(
        Order.objects.values_list("status")
        .annotate(count=Count("id"))
        .values_list("status", "count")
    )

    # ---------- Method breakdown ----------
    method_breakdown = dict(
        Order.objects.values_list("method")
        .annotate(count=Count("id"))
        .values_list("method", "count")
    )

    # ---------- Top 10 restaurants ----------
    top_restaurants = list(
        Order.objects.values("restaurant_id", "restaurant_names")
        .annotate(
            order_count=Count("id"),
            total_revenue=Sum("total_fee"),
        )
        .order_by("-order_count")[:10]
    )
    top_restaurants = [
        {
            "restaurant_id": str(r["restaurant_id"]),
            "restaurant_name": r["restaurant_names"],
            "order_count": r["order_count"],
            "total_revenue": float(r["total_revenue"] or 0),
        }
        for r in top_restaurants
    ]

    # ---------- Recent 20 orders ----------
    recent_orders = list(
        Order.objects.order_by("-created").values(
            "id", "restaurant_names", "total_fee", "status", "method", "created"
        )[:20]
    )
    recent_orders = [
        {
            "id": str(o["id"]),
            "restaurant_names": o["restaurant_names"],
            "total_fee": float(o["total_fee"] or 0),
            "status": o["status"],
            "method": o["method"],
            "created": o["created"].isoformat(),
        }
        for o in recent_orders
    ]

    # ---------- Daily revenue (last 30 days) ----------
    daily_revenue = list(
        Order.objects.filter(created__gte=month_start)
        .annotate(date=TruncDate("created"))
        .values("date")
        .annotate(
            revenue=Sum("total_fee"),
            orders=Count("id"),
        )
        .order_by("date")
    )
    daily_revenue = [
        {
            "date": d["date"].isoformat(),
            "revenue": float(d["revenue"] or 0),
            "orders": d["orders"],
        }
        for d in daily_revenue
    ]

    return Response(
        {
            "today": period_stats(today_qs),
            "week": period_stats(week_qs),
            "month": period_stats(month_qs),
            "all_time": {
                "orders": all_time_agg["count"] or 0,
                "revenue": float(all_time_agg["revenue"] or 0),
            },
            "status_breakdown": status_breakdown,
            "method_breakdown": method_breakdown,
            "top_restaurants": top_restaurants,
            "recent_orders": recent_orders,
            "daily_revenue": daily_revenue,
        }
    )


@api_view(["GET"])
@permission_classes([AllowAny])
def admin_order_detail(request, pk):
    try:
        order = Order.objects.prefetch_related("items").get(pk=pk)
    except Order.DoesNotExist:
        return Response({"error": "Order not found"}, status=404)

    items = [
        {
            "id": item.id,
            "menu_item_id": str(item.menu_item_id),
            "menu_item_name": item.menu_item_name,
            "menu_item_price": float(item.menu_item_price),
            "quantity": item.quantity,
            "price": float(item.price()),
        }
        for item in order.items.all()
    ]

    return Response(
        {
            "id": str(order.id),
            "customer_id": str(order.customer_id),
            "driver_id": str(order.driver_id) if order.driver_id else None,
            "restaurant_id": str(order.restaurant_id),
            "restaurant_names": order.restaurant_names,
            "status": order.status,
            "method": order.method,
            "total_fee": float(order.total_fee),
            "delivery_fee": float(order.delivery_fee),
            "tip": float(order.tip),
            "each_item_price": order.each_item_price,
            "external_order_numbers": order.external_order_numbers,
            "created": order.created.isoformat(),
            "delivery_out_time": order.delivery_out_time.isoformat() if order.delivery_out_time else None,
            "delivery_complete_time": order.delivery_complete_time.isoformat() if order.delivery_complete_time else None,
            "restaurant_lat": order.restaurant_lat,
            "restaurant_lng": order.restaurant_lng,
            "delivery_lat": order.delivery_lat,
            "delivery_lng": order.delivery_lng,
            "delivery_address": order.delivery_address,
            "driver_name": order.driver_name,
            "driver_phone": order.driver_phone,
            "driver_vehicle": order.driver_vehicle,
            "items": items,
        }
    )
