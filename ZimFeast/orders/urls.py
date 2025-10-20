from django.urls import path
from . import views

urlpatterns = [
    path("create/", views.create_order, name="create_order"),
    path("list/", views.OrderListView.as_view(), name="get_orders"),
    path("cancel/<uuid:pk>/", views.cancel_order, name="cancel_order"),
    path("all/orders/", views.get_all_orders, name="get_all_orders"),
    path("order/<uuid:pk>/", views.get_order, name="get_order_data"),
]
