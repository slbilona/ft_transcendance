# # Transcendance/Transcendance/routing.py

from django.urls import re_path, path
from .consumers import PlayConsumer

#path pour les URL simples pour les cas courants
#re_path pour les path avec regex (expressions regulieres)

websocket_urlpatterns = [
	path('wss/game/<int:game_id>/',  PlayConsumer.as_asgi()),
]
