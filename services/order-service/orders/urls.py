from django.urls import path
from . import views
from . import admin_views

urlpatterns = [
    path("create/", views.create_order, name="create_order"),
    path("list/", views.OrderListView.as_view(), name="get_orders"),
    path("cancel/<uuid:pk>/", views.cancel_order, name="cancel_order"),
    path("all/orders/", views.AllOrdersView.as_view(), name="get_all_orders"),
    path("order/<uuid:pk>/", views.get_order, name="get_order_data"),
    path("order/<uuid:pk>/assign-driver/", views.assign_driver, name="assign_driver"),
    path("order/<uuid:pk>/status/", views.update_order_status, name="update_order_status"),
    path("admin/analytics/", admin_views.admin_analytics, name="admin_analytics"),
    path("admin/order/<uuid:pk>/", admin_views.admin_order_detail, name="admin_order_detail"),
    path("health/", views.health_check, name="health_check"),
]
