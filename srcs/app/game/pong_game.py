import random
import asyncio
import django
import os

from channels.layers import get_channel_layer
from channels.db import database_sync_to_async
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Transcendance.settings')
django.setup()

from .models import Play

class PongGame:
	_instances = {}

	@classmethod
	def get_instance(cls, play_id, game_group_name):
		"""Méthode pour obtenir une instance unique par play_id"""
		if play_id not in cls._instances:
			cls._instances[play_id] = cls(play_id, game_group_name)
		return cls._instances[play_id]

	def __init__(self, play_id, game_group_name):
		self.width = 800
		self.height = 600
		self.paddle_width = 10
		self.paddle_height = 100
		self.ball_radius = 10
		self.is_running = False
		self.play = Play.objects.get(pk=play_id)
		self.game_group_name = game_group_name
		self.channel_layer = get_channel_layer()

		self.initial_ball_speed = 5
		self.acceleration_factor = 1.1
		self.max_ball_speed = 15

		# Initialisation des positions Y
		self.players_y = {1: self.height // 2 - self.paddle_height // 2,
						  2: self.height // 2 - self.paddle_height // 2}
		# Initialisation des positions X
		self.players_x = {1: 0,
						  2: self.width - 10}
		# Initialisation des scores
		self.team_scores = {1: 0,
							2: 0}
		
		# Initialisation des positions des players 3 et 4 si necessaire
		if self.play.nb_players == 4:
			self.players_y.update({
				3: self.players_y[1],
				4: self.players_y[1]
			})
			self.players_x.update({
				3: self.width // 4,
				4: (self.width // 4) * 3
			})

		# Initialisation de la balle
		self.ball_x, self.ball_y = self.width // 2, self.height // 2
		self.ball_speed_x = self.initial_ball_speed * random.choice((1, -1))
		self.ball_speed_y = self.initial_ball_speed * random.choice((1, -1))

		self._lock = asyncio.Lock()

	# Cette fonction lance une partie en creant une tache en arriere plan dans laquelle la boucle du jeu se lance
	# Cela permet a la boucle de se lancer tout en liberant le consumer pour qu'il ne bloque pas au lancement du jeu
	async def start_game(self):
		if not self.is_running:
			self.is_running = True
			self.game_loop_task = asyncio.create_task(self.game_loop())

	# Stockage de resultats si la partie est terminee normalement
	async def stop_game(self):
		if self.play.is_finished:
			winners = await self.get_winners()
			losers = await self.get_losers()
			score = str(self.team_scores[1]) + "-" + str(self.team_scores[2])
			self.play.results = {
				"winners": winners,
				"losers": losers,
				"score": score
			}
			self.play.date = timezone.now()
			await database_sync_to_async(self.play.save)()

	async def get_winners(self):
		winners = []
		if self.team_scores[1] == 3:
			winners.append(await self.get_player_id(1))
			await self.play.add_victory(1)
			if self.play.nb_players == 4:
				winners.append(await self.get_player_id(3))
				await self.play.add_victory(3)
		else:
			winners.append(await self.get_player_id(2))
			await self.play.add_victory(2)
			if self.play.nb_players == 4:
				winners.append(await self.get_player_id(4))
				await self.play.add_victory(4)
		return winners

	async def get_losers(self):
		losers = []
		if self.team_scores[1] == 3:
			losers.append(await self.get_player_id(2))
			await self.play.add_defeat(2)
			if self.play.nb_players == 4:
				losers.append(await self.get_player_id(4))
				await self.play.add_defeat(4)
		else :
			losers.append(await self.get_player_id(1))
			await self.play.add_defeat(1)
			if self.play.nb_players == 4:
				losers.append(await self.get_player_id(3))
				await self.play.add_defeat(3)
		return losers

	@database_sync_to_async
	def get_player_id(self, player_number):
		if player_number == 1:
			return self.play.player1.id if self.play.player1 is not None else "player1"
		elif player_number == 2:
			return self.play.player2.id if self.play.player2 is not None else "player2"
		elif player_number == 3:
			return self.play.player3.id if self.play.player3 is not None else "player3"
		elif player_number == 4:
			return self.play.player4.id if self.play.player4 is not None else "player4"
		return "Unknown_player"

	async def update_player_position(self, player_number, move_direction):
		async with self._lock:  # Utilisation du lock pour éviter les conflits
			print(f"Updating player {player_number} position, direction: {move_direction}")
			if player_number in self.players_y:
				step = 10
				current_y = self.players_y[player_number]
				
				if move_direction == 'up' and current_y > 0:
					self.players_y[player_number] = max(0, current_y - step)
				elif move_direction == 'down' and current_y < self.height - self.paddle_height:
					self.players_y[player_number] = min(self.height - self.paddle_height, current_y + step)
				
				print(f"New position for player {player_number}: {self.players_y[player_number]}")

	async def update_game_state(self):
		# Update ball position
		self.ball_x += self.ball_speed_x
		self.ball_y += self.ball_speed_y

		# Gestion des collisions avec les murs du haut et du bas
		if self.ball_y - self.ball_radius <= 0 or self.ball_y + self.ball_radius >= self.height:
			self.ball_speed_y *= -1
			# Ajuster la position de la balle pour éviter qu'elle ne reste au mur
			self.ball_y = max(self.ball_radius, min(self.height - self.ball_radius, self.ball_y))

		# Gestion des collisions avec les raquettes
		collision_occurred = False
		
		# Collision avec la raquette de gauche (joueurs 1 et 3)
		if (self.ball_x - self.ball_radius <= self.paddle_width and
			self.players_y[1] < self.ball_y < self.players_y[1] + self.paddle_height):
			self.ball_speed_x = abs(self.ball_speed_x) * self.acceleration_factor
			self.ball_x = self.paddle_width + self.ball_radius
			collision_occurred = True

		# Collision avec la raquette de droite (joueurs 2 et 4)
		elif (self.ball_x + self.ball_radius >= self.width - self.paddle_width and
			  self.players_y[2] < self.ball_y < self.players_y[2] + self.paddle_height):
			self.ball_speed_x = -abs(self.ball_speed_x) * self.acceleration_factor
			self.ball_x = self.width - self.paddle_width - self.ball_radius
			collision_occurred = True

		# Collisions pour un jeu à 4 joueurs
		if self.play.nb_players == 4:
			# Collision avec la raquette de gauche inférieure
			if (self.ball_x - self.ball_radius <= self.players_x[3] + self.paddle_width and
				self.players_x[3] <= self.ball_x and
				self.players_y[3] < self.ball_y < self.players_y[3] + self.paddle_height):
				self.ball_speed_x = abs(self.ball_speed_x) * self.acceleration_factor
				self.ball_x = self.players_x[3] + self.paddle_width + self.ball_radius
				collision_occurred = True

			# Collision avec la raquette de droite inférieure
			if (self.ball_x + self.ball_radius >= self.players_x[4] and
				self.players_x[4] >= self.ball_x and
				self.players_y[4] < self.ball_y < self.players_y[4] + self.paddle_height):
				self.ball_speed_x = -abs(self.ball_speed_x) * self.acceleration_factor
				self.ball_x = self.players_x[4] - self.ball_radius
				collision_occurred = True

		# Limiter la vitesse maximale
		if collision_occurred:
			# Limiter la vitesse en X
			self.ball_speed_x = max(-self.max_ball_speed, min(self.max_ball_speed, self.ball_speed_x))
			# Ajouter un peu d'accélération verticale
			self.ball_speed_y *= self.acceleration_factor
			self.ball_speed_y = max(-self.max_ball_speed, min(self.max_ball_speed, self.ball_speed_y))

		# Comptage des points et réinitialisation de la balle
		if self.ball_x - self.ball_radius <= 0:
			self.team_scores[2] += 1
			await self.reset_ball()
		elif self.ball_x + self.ball_radius >= self.width:
			self.team_scores[1] += 1
			await self.reset_ball()

		# Retourne l'ensemble des positions de la partie
		data = {
			'ball': (self.ball_x, self.ball_y),
			'player_1': (self.players_x[1], self.players_y[1]),
			'player_2': (self.players_x[2], self.players_y[2]),
			'score_team_1': self.team_scores[1],
			'score_team_2': self.team_scores[2]
		}
		
		if self.play.nb_players == 4:
			data['player_3'] = (self.players_x[3], self.players_y[3])
			data['player_4'] = (self.players_x[4], self.players_y[4])
		
		return data

	async def reset_ball(self):
		# Réinitialiser la position de la balle au centre
		self.ball_x, self.ball_y = self.width // 2, self.height // 2
		
		# Réinitialiser la vitesse à la valeur initiale
		self.ball_speed_x = self.initial_ball_speed * random.choice((1, -1))
		self.ball_speed_y = self.initial_ball_speed * random.choice((1, -1))

	async def game_loop(self):
		while self.is_running:
			game_state = await self.update_game_state()
			await database_sync_to_async(self.play.refresh_from_db)()
			await self.channel_layer.group_send(
				self.game_group_name,
				{
					'type': 'update_game',
					**game_state
				}
			)
			await asyncio.sleep(1 / 60)
			if self.team_scores[1] == 3 or self.team_scores[2] == 3:
				self.is_running = False
				self.play.is_finished = True
				await database_sync_to_async(self.play.save)()
				await self.stop_game()
				await self.channel_layer.group_send(
					self.game_group_name,
					{
						'type': 'update_game',
						'message': 'end_game'
					}
				)
				
