from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from .views import ReactAppView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/restaurants/', include('restaurants.urls')),
    path("api/payments/", include("payments.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/drivers/", include("drivers.urls")),
    path("api/accounts/", include("accounts.urls")),
    re_path(r'^.*$', ReactAppView.as_view()),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
