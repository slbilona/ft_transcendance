"""
ASGI config for Transcendance project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/asgi/
"""

import os
import django
from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application
from channels.auth import AuthMiddlewareStack #(authentification de qui utilise la socket)
# En gros l'authentification permettra une personnalisation car acces a l'utiisateur connecte dans le Consumer
from django.urls import path
from game.routing import websocket_urlpatterns as game_websocket_urlpatterns
from liveChat.routing import websocket_urlpatterns as chat_websocket_patterns

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Transcendance.settings')

application = ProtocolTypeRouter({
    "http": get_asgi_application(),
    "websocket": AuthMiddlewareStack(  # Ajoutez AuthMiddlewareStack ici
        URLRouter(
            game_websocket_urlpatterns + chat_websocket_patterns
        )
    ),
})

