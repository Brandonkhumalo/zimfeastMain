from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from .views import ReactAppView
import os

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/restaurants/', include('restaurants.urls')),
    path("api/payments/", include("payments.urls")),
    path("api/orders/", include("orders.urls")),
    path("api/drivers/", include("drivers.urls")),
    path("api/accounts/", include("accounts.urls")),
]

# Serve static assets in production
if not settings.DEBUG or os.environ.get('REPL_SLUG'):
    urlpatterns += [
        re_path(r'^assets/(?P<path>.*)$', serve, {
            'document_root': os.path.join(settings.STATIC_ROOT, 'assets'),
        }),
    ]

# Media files
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Catch-all for React app (must be last)
urlpatterns += [
    re_path(r'^.*$', ReactAppView.as_view()),
]
