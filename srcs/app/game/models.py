import json
import threading
from asgiref.sync import async_to_sync
from django.conf import settings
from django.db import models
from channels.db import database_sync_to_async
from authentication.models import User
from web3 import Web3, AsyncWeb3, AsyncHTTPProvider, exceptions
import sys

# Create your models here.

class Play(models.Model):

	#Liason de ce joueur a cette partie, ce joueur peut etre lier a plusieurs parties
	player1 = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='player1')
	player2 = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='player2')
	player3 = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='player3')
	player4 = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='player4')

	#Lier la partie a un tournoi, la partie peut etre lier uniquemenr a ce tournoi
	#Liason a Tournament via une string car Django le permet pour eviter les boucles d'importations [Importer Tournament dans un fichier qui contient deja Tournament]
	#Django resout la string avec le model qui est declare plus tard dans le fichier
	tournament = models.ForeignKey('Tournament', related_name='plays', on_delete=models.SET_NULL, null=True)
	tournament_round = models.PositiveIntegerField(default=1)
	player_connected= models.PositiveIntegerField(default=0)#Nombre de joueurs connectes a la partie
	nb_players = models.IntegerField(choices=[(2, 'Deux joueurs'), (4, 'Quatre joueurs')], default=2)# Nombre de joueur = mode normal ou 2V2# Nombre de joueur = mode normal ou 2V2
	remote = models.BooleanField(default=False)# Remote ou pas
	date = models.DateTimeField(blank=True, null=True)
	is_finished = models.BooleanField(default=False)

	private = models.BooleanField(default=False)

	#Choix de stocker les resultats dans un JSONField pour permettre une flexibilite au client en terme d'affchage
	#Possibilite de modifier le field sans toucher a la base de donnee
	results = models.JSONField(null=True, blank=True)

	async def add_victory(self, nb_player):
		if nb_player == 1:
			player = self.player1
		elif nb_player == 2:
			player = self.player2
		elif nb_player == 3:
			player = self.player3
		elif nb_player == 4:
			player = self.player4
		else :
			player = None

		if player is not None :
			player.nbVictoires += 1
			await database_sync_to_async(player.save)()

			sys.stdout.flush()

	async def add_defeat(self, nb_player):
		if nb_player == 1:
			player = self.player1
		elif nb_player == 2:
			player = self.player2
		elif nb_player == 3:
			player = self.player3
		elif nb_player == 4:
			player = self.player4
		else :
			player = None

		if player is not None :
			player.nbDefaites += 1
			await database_sync_to_async(player.save)()
			sys.stdout.flush()

	def add_player(self, player):
		if self.player1 is None:
			self.player1 = player
		elif self.player2 is None:
			self.player2 = player
		elif self.player3 is None:
			self.player3 = player
		elif self.player4 is None:
			self.player4 = player
		else:
			return False
		self.save()
		return True

#Pour acceder aux parties dans un tournoi, utiliser l'attribut reverse genere automatiquement par Django grace au related_name
#Exemple ici tournament.plays.all()
class Tournament(models.Model):

	#Nombre joueur d'un tournoi flexible, soumis a des choix predefinis tout de meme (possibilite d'etendre ce choix dans le futur)
	nb_players = models.IntegerField(choices=[ (4, 'Quatre joueurs'), (8, 'Huit joueurs')], default=4)
	players = models.ManyToManyField(User, related_name='tournaments_players')
	results = models.JSONField(null=True, blank=True)
	is_finished = models.BooleanField(default=False)
	current_round = models.IntegerField(default=0)

	def create_next_round(self):

		if self.current_round == 0: #Cas du premier round
			players = self.players.all()
			self.create_plays_for_new_round(players)
		else: #recherche de toutes les parties finies du round actuel
			plays_from_last_round = Play.objects.filter(tournament=self, tournament_round=self.current_round, is_finished=True)

			if plays_from_last_round.count() == 1:#La finale a ete jouee
				#Stockage de results avec plays_from_last_round
				final_play = plays_from_last_round.first()
				self.results = {
					"players": [player.id for player in self.players.all()],
					"winner": final_play.results.get('winners', []),#protection contre absence de 'winners'
					"final_score": final_play.results.get('score', {})
				}
				self.is_finished = True



			else :#Creation de toutes les parties du prochain round
				winners = []
				for play in plays_from_last_round:
					winner_ids = play.results.get('winners', [])
					winners.extend(User.objects.filter(id__in=winner_ids))#recherche des id dans le dictionnaire winners_id

				if winners:
					self.create_plays_for_new_round(winners)
				else:
					print(f"PROBLEME: Aucun gagnant trouvé pour le round {self.current_round}")

		if not self.is_finished:
			self.current_round += 1
		self.save()

	def create_plays_for_new_round(self, players):
		players = list(players)

		#Ajout d'un joueur fictif en cas de joueur impairs
		if len(players) % 2 != 0:
			players.append(None)

		for i in range(0, len(players), 2):
			player1 = players[i]
			player2 = players[i + 1] if i + 1 < len(players) else None

			#Creation de partie avec les 2 joueurs
			if player1 and player2:
				Play.objects.create(
					player1=player1,
					player2=player2,
					tournament=self,
					tournament_round=self.current_round + 1
				)
			elif player1:#Simulation de partie gagne sur tapis vert pour le joueur seul en cas d'impair
				simulate_play = Play.objects.create(
					player1=player1,
					player2=None,
					tournament=self,
					tournament_round=self.current_round + 1
				)
				simulate_play.results = {'winners': [player1.id], 'losers': 'player2', 'score': '3-0'}
				simulate_play.is_finished = True
				simulate_play.save()
