from unittest.mock import patch
from channels.testing import WebsocketCommunicator
# from django.test import TestCase
from django.test import LiveServerTestCase
from channels.db import database_sync_to_async
from channels.layers import get_channel_layer

from Transcendance.asgi import application
from game.models import Play
from game.consumers import PlayConsumer

class TestPlayConsumer(LiveServerTestCase):

	def setUp(self):
		self.play_remote = Play.objects.create(remote=True)
		self.play_unavailable = Play.objects.create(is_finished=True)
		self.play = Play.objects.create()

	async def test_can_connect_and_disconnect(self):
		communicator = WebsocketCommunicator(application, f"/wss/game/{self.play_remote.id}/")
		connected = await communicator.connect()
		self.assertTrue(connected)
		#A faire dans un test absolument pour etre sur de recuperer le dernier etat en stock dans la base de donnee
		await database_sync_to_async(self.play_remote.refresh_from_db)()
		self.assertEqual(self.play_remote.player_connected, 1)
		await communicator.disconnect()
		await database_sync_to_async(self.play_remote.refresh_from_db)()
		self.assertEqual(self.play_remote.player_connected, 0)

	async def test_bad_game_id_connection(self):
		communicator = WebsocketCommunicator(application, "/wss/game/1000/")
		connected = await communicator.connect()
		self.assertEqual(connected[1], 4001)
		#Besoin de disconnect ici ?

	async def test_connection_play_unavailable(self):

		self.play.is_finished = True
		communicator2 = WebsocketCommunicator(application, f"/wss/game/{self.play_unavailable.id}/")
		connected2 = await communicator2.connect()
		self.assertEqual(connected2[1], 4002)

	#Creation d'une socket lancant reellement le jeu : Test du lancement de partie, reception de position, envoi de mouvement
	async def test_integration_Pong(self):
		#Connection + lancement du jeu en arriere plan
		communicator = WebsocketCommunicator(application, f"/wss/game/{self.play.id}/")
		connected = await communicator.connect()
		self.assertTrue(connected)
		#reception de positions du jeu
		response = await communicator.receive_json_from()
		test_pos_y_player1 = response['player_1'][1]
		#Test d'un mouvement de player + un message au mauvais format sans effet
		await communicator.send_json_to({'player': 1, 'move': 'up'})
		await communicator.send_json_to({'player': 1, 'message':'bad_format'})
		response_afetr_move = await communicator.receive_json_from()
		test_pos_y_player1_after_move = response_afetr_move['player_1'][1]
		self.assertEqual(test_pos_y_player1 - 10, test_pos_y_player1_after_move)
		await communicator.disconnect()


