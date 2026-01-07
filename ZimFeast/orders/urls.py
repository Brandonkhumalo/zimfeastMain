from django.urls import path
from . import views
from restaurants.views import mark_order_preparing, mark_order_ready, mark_order_collected

urlpatterns = [
    path("create/", views.create_order, name="create_order"),
    path("list/", views.OrderListView.as_view(), name="get_orders"),
    path("cancel/<uuid:pk>/", views.cancel_order, name="cancel_order"),
    path("all/orders/", views.get_all_orders, name="get_all_orders"),
    path("order/<uuid:pk>/", views.get_order, name="get_order_data"),
    path("order/<uuid:pk>/assign-driver/", views.assign_driver, name="assign_driver"),
    path("order/<uuid:pk>/status/", views.update_order_status, name="update_order_status"),
    path("<uuid:order_id>/preparing/", mark_order_preparing, name="mark_order_preparing"),
    path("<uuid:order_id>/ready/", mark_order_ready, name="mark_order_ready"),
    path("<uuid:order_id>/collected/", mark_order_collected, name="mark_order_collected"),
]
