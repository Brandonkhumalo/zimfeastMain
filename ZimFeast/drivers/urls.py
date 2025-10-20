from django.urls import path
from . import views

urlpatterns = [
    path("profile/create/", views.create_driver_profile, name="create_driver_profile"),
    path("status/toggle/", views.toggle_driver_status, name="toggle_driver_status"),
    path("status/", views.get_driver_status, name="toggle_driver_status"),
    path("order/<str:pk>/reject/", views.reject_order, name="reject_order"),
    path("location/update/", views.update_driver_location, name="update_driver_location"),
    path("order/<str:order_id>/cancel/", views.cancel_order, name="driver_cancel_order"),
    path('active/orders/', views.driver_active_orders, name="active_driver_orders"),
    path("orders/history/", views.driver_completed_cancelled_orders, name="driver-completed-cancelled-orders"),
    path("daily/finances/", views.driver_finance_view, name="driver_finances"),
    path("rate/driver/", views.submit_driver_rating, name="rate_driver"),
]
