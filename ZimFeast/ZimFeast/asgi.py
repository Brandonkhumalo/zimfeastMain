import os
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ZimFeast.settings")

# Get Django ASGI application first - this initializes Django
django_asgi_app = get_asgi_application()

# Now import channels and routing after Django is initialized
from channels.auth import AuthMiddlewareStack
from channels.routing import ProtocolTypeRouter, URLRouter
import restaurants.routing
import drivers.routing

application = ProtocolTypeRouter({
    "http": django_asgi_app,  # Handle traditional HTTP requests
    "websocket": AuthMiddlewareStack(
        URLRouter(
            restaurants.routing.websocket_urlpatterns +
            drivers.routing.websocket_urlpatterns  # combine other apps if needed
        )
    ),
})
