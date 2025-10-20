import os
from django.core.asgi import get_asgi_application
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
import restaurants.routing
import drivers.routing  # if you have a drivers app with websocket routing

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ZimFeast.settings")

# Standard Django ASGI application for HTTP
django_asgi_app = get_asgi_application()

application = ProtocolTypeRouter({
    "http": django_asgi_app,  # Handle traditional HTTP requests
    "websocket": AuthMiddlewareStack(
        URLRouter(
            restaurants.routing.websocket_urlpatterns +
            drivers.routing.websocket_urlpatterns  # combine other apps if needed
        )
    ),
})
