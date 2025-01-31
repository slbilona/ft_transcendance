from django.test import TestCase

from authentication.models import User
from game.models import Play, Tournament

class TestPlayModel(TestCase):

	def setUp(self):
		self.play = Play.objects.create(nb_players=4, remote=True)
		self.user1 = User.objects.create(username='testuser1', password='p#ssword123',email='test@42.fr')
		self.user2 = User.objects.create(username='testuser2', password='p#ssword1234',email='test2@42.fr')
		self.play.player1 = self.user1
		self.play.player2 = self.user2
		self.play.save()

	def test_model_creation(self):

		self.assertEqual(self.play.nb_players, 4)
		self.assertEqual(self.play.remote, True)
		self.assertEqual(self.play.player1, self.user1)
		self.assertEqual(self.play.player2, self.user2)

	def test_default_value(self):
		play = Play.objects.create()
		self.assertEqual(play.player_connected, 0)
		self.assertEqual(play.nb_players, 2)
		self.assertEqual(play.remote, False)

class TestTournamentModel(TestCase):
	def setUp(self):
		self.tournament = Tournament.objects.create()

	# def test_model_creation(self):
	# 	self.assertTrue(self.tournament.exist())

	def test_default_value(self):
		self.assertEqual(self.tournament.nb_players, 4)
		self.assertEqual(self.tournament.is_finished, False)
		self.assertEqual(self.tournament.results, None)

	# def test_validation(self):
		#Pour l'instant aucune validation directement dans le model

	#def test_relationship(self):
		#Test a faire lorsque le model Player sera operationnel


