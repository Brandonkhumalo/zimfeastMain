from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/restaurants/', include('restaurants.urls')),
    path("api/payments/", include("payments.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/drivers/", include("drivers.urls")),
    path("api/accounts/", include("accounts.urls")),
]

#python manage.py runserver 0.0.0.0:8000
