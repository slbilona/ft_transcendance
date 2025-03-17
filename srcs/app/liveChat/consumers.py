import json
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from .models import Conversation, Message
from asgiref.sync import sync_to_async
from .models import Message
from authentication.models import User
from django.db.models import Q
from channels.db import database_sync_to_async
import sys
from game.models import Play
import asyncio
from game.pong_game import PongGame

User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
	async def connect(self):
		self.user = self.scope["user"]
		if self.user.is_authenticated:
			self.user_group_name = f"user_{self.user.id}"
			self.user.onlineStatus = True
			await database_sync_to_async(self.user.save)()
			
			# Ajouter au groupe individuel et global
			await self.channel_layer.group_add(self.user_group_name, self.channel_name)
			await self.channel_layer.group_add("global_users", self.channel_name)
			
			# Informer tous les utilisateurs de la connexion
			await self.channel_layer.group_send(
				"global_users",
				{
					"type": "connection_status",
					"user_id": self.user.id,
					"status": "connected",
				}
			)
			
			await self.accept()
		else:
			await self.close()

	async def disconnect(self, close_code):
		if self.user.is_authenticated:
			# Recharger les données de l'utilisateur depuis la base
			await database_sync_to_async(self.user.refresh_from_db)()

			# Mise à jour du statut en ligne
			self.user.onlineStatus = False
			await database_sync_to_async(self.user.save)()

			# Retirer des groupes
			await self.channel_layer.group_discard(self.user_group_name, self.channel_name)
			await self.channel_layer.group_discard("global_users", self.channel_name)

			# Informer tous les utilisateurs de la déconnexion
			await self.channel_layer.group_send(
				"global_users",
				{
					"type": "connection_status",
					"user_id": self.user.id,
					"status": "disconnected",
				}
			)
			
	async def connection_status(self, event):
		user_id = event["user_id"]
		status = event["status"]  # "connected" ou "disconnected"

		# Envoyer le message à ce client WebSocket
		await self.send(text_data=json.dumps({
			"type": "connection_status",
			"user_id": user_id,
			"status": status,
		}))

	async def receive(self, text_data):
		data = json.loads(text_data)
		event_type = data.get("type")
		destinataire_id = data.get("destinataire_id")

		try:
			destinataire = await sync_to_async(User.objects.get)(id=destinataire_id)
		except User.DoesNotExist:
			await self.send(text_data=json.dumps({"error": "Destinataire non trouvé"}))
			return
		
		if event_type == "send_message":
			await self.handle_send_message(data, destinataire)
		elif event_type == "pong_invitation":
			await self.handle_pong_invitation(destinataire)
		elif event_type == "block_user":
			block_type = data.get("block_type")
			await self.handle_block_user(destinataire, block_type)
		elif event_type == "pong_invitation_annulation":
			await self.handle_pong_invitation_annulation(data, destinataire)
		elif event_type == "pong_invitation_refuse":
			await self.handle_pong_invitation_refuse(data, destinataire)
		elif event_type == "pong_invitation_accepté":
			await self.handle_pong_invitation_accepte(data, destinataire)
		else:
			test = "Type d'événement inconnu : '" + event_type + "'"
			await self.send(text_data=json.dumps({"error": test}))

	async def handle_send_message(self, data, destinataire):
		style = "message"
		message_text = data.get("message")
		
		# Étape 1: Chercher ou créer la conversation
		conversation = await sync_to_async(Conversation.objects.filter(
			(Q(user_1=self.user) & Q(user_2=destinataire)) |
			(Q(user_1=destinataire) & Q(user_2=self.user))
		).first)()
		
		if not conversation:
			conversation = await sync_to_async(Conversation.objects.create)(
				user_1=self.user, user_2=destinataire
			)

		# Étape 2: Enregistrer le message
		message_obj = await sync_to_async(Message.objects.create)(
			style=style, expediteur=self.user, destinataire=destinataire,
			message=message_text, conversation=conversation
		)

		message_data = {
			"style": style,
			"expediteur": self.user.username,
			"destinataire": destinataire.username,
			"expediteur_id": self.user.id,
			"destinataire_id": destinataire.id,
			"message": message_text,
			"date": message_obj.date.isoformat()  # Utilisation de isoformat() pour la date
		}
			
		# Étape 3: Envoyer le message au destinataire
		await self.channel_layer.group_send(
			f"user_{destinataire.id}",
			{
				"type": "chat_message",
				"message_data": message_data
			}
		)

		# Étape 4: Envoyer le message à l'utilisateur courant
		await self.send(text_data=json.dumps({
				'type': "message",
				'message': message_data
			}))
		
	async def chat_message(self, event):
		# Récupère les données du message
		message_data = event["message_data"]

		# Envoie le message via WebSocket
		await self.send(text_data=json.dumps({
				'type': "message",
				'message': message_data
			}))

	async def handle_pong_invitation(self, destinataire):
		style = "jeu"

		# Étape 2 : Chercher ou créer la conversation
		conversation = await sync_to_async(Conversation.objects.filter(
			(Q(user_1=self.user) & Q(user_2=destinataire)) |
			(Q(user_1=destinataire) & Q(user_2=self.user))
		).first)()

		if not conversation:
			conversation = await sync_to_async(Conversation.objects.create)(
				user_1=self.user, user_2=destinataire
			)
		else:
			# Rafraîchir pour s'assurer d'avoir la version la plus récente
			await database_sync_to_async(conversation.refresh_from_db)()

		# Étape 3 : Créer le message dans la base de données et mettre `invitationAJouer` à True
		message_obj = await sync_to_async(Message.objects.create)(
			style=style, expediteur=self.user, destinataire=destinataire,
			message="invitation à jouer", conversation=conversation
		)

		# Modifier la conversation en base
		conversation.invitationAJouer = True
		await database_sync_to_async(conversation.save)()

		#Etape 4: Envoyer un message aux deux personnes qui leur indique qu'une invitation a été lancé
		message_data = {
			"style": style,
			"expediteur_id": self.user.id,
			"expediteur_username": self.user.username,
			"destinataire_id": destinataire.id,
			"destinataire_username": destinataire.username,
			"message_id": message_obj.id,
			"message": "invitation à jouer",
			"timeout": 60,  # Temps en secondes
			"date": message_obj.date.isoformat()  # Utilisation de isoformat() pour la date
		}

		await self.channel_layer.group_send(
			f"user_{destinataire.id}",
			{
				"type": "pong_invitation_event",
				"message_data": message_data
			})
		await self.send(text_data=json.dumps({
				'type': "pong_invitation",
				'message': message_data
			}))
		
		# Etape 5: Attendre 60 secondes pour la réponse
		asyncio.create_task(self.handle_invitation_timeout(conversation.id, message_obj, destinataire))

	async def handle_invitation_timeout(self, conversation_id, message_obj, destinataire):
		# Attendre 60 secondes
		await asyncio.sleep(60)

		# Étape 6: Vérifier si l'invitation est toujours active
		conversation_refreshed = await sync_to_async(Conversation.objects.get)(id=conversation_id)
		if conversation_refreshed.invitationAJouer:
			# Étape 7: Rafraîchir les données du message avant de le modifier
			await database_sync_to_async(message_obj.refresh_from_db)()

			# Repasser l'invitation à False et modifier le message
			conversation_refreshed.invitationAJouer = False
			await database_sync_to_async(conversation_refreshed.save)()

			message_obj.message = "temps écoulé"
			await database_sync_to_async(message_obj.save)()

			# Étape 8: Envoyer un message aux deux utilisateurs
			message_data = {
				"style": "jeu",
				"expediteur_id": self.user.id,
				"expediteur_username": self.user.username,
				"destinataire_id": destinataire.id,
				"destinataire_username": destinataire.username,
				"message_id": message_obj.id,
				"message": "temps écoulé",
				"timeout": 0,
				"date": message_obj.date.isoformat()
			}

			await self.channel_layer.group_send(
				f"user_{destinataire.id}",
				{
					"type": "pong_invitation_event",
					"message_data": message_data
				})

			await self.send(text_data=json.dumps({
				"type": "pong_invitation",
				"message": message_data
			}))

	async def pong_invitation_event(self, event):
		message_data = event["message_data"]
		await self.send(text_data=json.dumps({
			"type": "pong_invitation",
			"message": message_data
		}))

	async def handle_pong_invitation_annulation(self, data, destinataire):
		message_id_db = data.get("message_id_db")
		style = "jeu"

		# Étape 1: Mettre à jour le message dans la base de données
		try:
			message = await sync_to_async(Message.objects.get)(id=message_id_db)
		except Message.DoesNotExist:
			await self.send(text_data=json.dumps({"error": "Message non trouvé"}))
			return

		# Rafraîchir les données du message pour éviter les conflits
		await database_sync_to_async(message.refresh_from_db)()
		message.message = "invitation annulée"
		await database_sync_to_async(message.save)()

		# Étape 2: Chercher la conversation et mettre invitationAJouer à False
		conversation = await sync_to_async(Conversation.objects.filter(
			(Q(user_1=self.user) & Q(user_2=destinataire)) |
			(Q(user_1=destinataire) & Q(user_2=self.user))
		).first)()

		if conversation:  # Vérifier si la conversation existe
			conversation.invitationAJouer = False
			await database_sync_to_async(conversation.save)()

		# Étape 3: Renvoyer l'info aux deux utilisateurs
		message_data = {
			"style": style,
			"expediteur_id": self.user.id,
			"expediteur_username": self.user.username,
			"destinataire_id": destinataire.id,
			"destinataire_username": destinataire.username,
			"message_id": message.id,
			"message": "invitation annulée",
			"date": message.date.isoformat()  # Utilisation de isoformat() pour la date
		}

		await self.send(text_data=json.dumps({
			"type": "pong_invitation",
			"message": message_data
		}))

		await self.channel_layer.group_send(
			f"user_{destinataire.id}",
			{
				"type": "pong_invitation_annulée_event",
				"message_data": message_data
			}
		)
		
	async def pong_invitation_annulée_event(self, event):
		await self.send(text_data=json.dumps({
			"type": "pong_invitation",
			"message": event["message_data"]
		}))

	async def handle_pong_invitation_refuse(self, data, destinataire):
		message_id_db = data.get("message_id_db")
		style = "jeu"

		# Étape 1: Mettre à jour le message dans la base de données
		try:
			message = await database_sync_to_async(Message.objects.get)(id=message_id_db)
		except Message.DoesNotExist:
			await self.send(text_data=json.dumps({"error": "Message non trouvé"}))
			return

		await database_sync_to_async(message.refresh_from_db)()  # Rafraîchir avant modification
		message.message = "invitation refusée"
		await database_sync_to_async(message.save)()

		# Étape 2: Chercher la conversation et mettre `invitationAJouer` à False
		try:
			conversation = await database_sync_to_async(Conversation.objects.get)(
				Q(user_1=self.user, user_2=destinataire) |
				Q(user_1=destinataire, user_2=self.user)
			)
		except Conversation.DoesNotExist:
			await self.send(text_data=json.dumps({"error": "Conversation non trouvée"}))
			return

		await database_sync_to_async(conversation.refresh_from_db)()  # Rafraîchir avant modification
		conversation.invitationAJouer = False
		await database_sync_to_async(conversation.save)()

		# Étape 3: Renvoyer l'info aux deux personnes
		message_data = {
			"style": style,
			"expediteur_id": destinataire.id,
			"expediteur_username": destinataire.username,
			"destinataire_id": self.user.id,
			"destinataire_username": self.user.username,
			"message_id": message.id,
			"message": "invitation refusée",
			"date": message.date.isoformat()  # Utilisation de isoformat() pour la date
		}

		await self.send(text_data=json.dumps({
			"type": "pong_invitation",
			"message": message_data
		}))

		await self.channel_layer.group_send(
			f"user_{destinataire.id}",
			{
				"type": "pong_invitation_refusée_event",
				"message_data": message_data
			}
		)

	async def pong_invitation_refusée_event(self, event):
		await self.send(text_data=json.dumps({
			"type": "pong_invitation",
			"message": event["message_data"]
		}))
		
	async def handle_pong_invitation_accepte(self, data, destinataire):
		message_id_db = data.get("message_id_db")
		gameId = data.get("gameId")
		style = "jeu"

		# Étape 1: Mettre à jour le message dans la base de données
		try:
			message = await database_sync_to_async(Message.objects.get)(id=message_id_db)
		except Message.DoesNotExist:
			await self.send(text_data=json.dumps({"error": "Message non trouvé"}))
			return
		
		try:
			game = await database_sync_to_async(Play.objects.get)(id=gameId)
		except Play.DoesNotExist:
			await self.send(text_data=json.dumps({"error": "Partie non trouvée", "message": gameId}))
			return

		await database_sync_to_async(message.refresh_from_db)()  # Rafraîchir avant modification
		message.play = game
		message.message = "invitation acceptée"
		await database_sync_to_async(message.save)()

		# Étape 2: Chercher la conversation et mettre `invitationAJouer` à False
		try:
			conversation = await database_sync_to_async(Conversation.objects.get)(
				Q(user_1=self.user, user_2=destinataire) |
				Q(user_1=destinataire, user_2=self.user)
			)
		except Conversation.DoesNotExist:
			await self.send(text_data=json.dumps({"error": "Conversation non trouvée"}))
			return

		await database_sync_to_async(conversation.refresh_from_db)()  # Rafraîchir avant modification
		conversation.invitationAJouer = False
		await database_sync_to_async(conversation.save)()

		# Étape 3: Renvoyer l'info aux deux personnes
		message_data = {
			"style": style,
			"expediteur_id": destinataire.id,
			"expediteur_username": destinataire.username,
			"destinataire_id": self.user.id,
			"destinataire_username": self.user.username,
			"message_id": message.id,
			"message": "invitation acceptée",
			"gameId": message.play.id,
			"date": message.date.isoformat()  # Utilisation de isoformat() pour la date
		}

		await self.send(text_data=json.dumps({
			"type": "pong_invitation",
			"message": message_data
		}))

		await self.channel_layer.group_send(
			f"user_{destinataire.id}",
			{
				"type": "pong_invitation_acceptée_event",
				"message_data": message_data
			}
		)

		await asyncio.sleep(2)

		# Étape 4: Attendre la fin du jeu avec gestion des erreurs
		# Récupérer l'instance du jeu
		game_group_name = 'game_' + str(gameId)
		pong_game_instance = PongGame.get_instance(gameId, game_group_name)

		# Attente asynchrone jusqu'à ce que la partie commence
		while not pong_game_instance.is_running:
			await asyncio.sleep(1)  # On attend 1 seconde avant de vérifier à nouveau

		# Une fois que is_running est True, on attend la fin du jeu
		try:
			await self.wait_for_game_to_finish(destinataire, message)
		except Exception as e:
			print(f"Erreur lors de l'attente de la fin du jeu : {e}", flush=True)

	async def pong_invitation_acceptée_event(self, event):
		await self.send(text_data=json.dumps({
			"type": "pong_invitation",
			"message": event["message_data"]
		}))

	async def handle_block_user(self, destinataire, block_type):
		await self.channel_layer.group_send(
			f"user_{destinataire.id}",
			{
				"type": "block_user_event",
				"block_type": block_type,
				"blocker_id": self.user.id,
				"blocker_username": self.user.username
			}
		)

	async def block_user_event(self, event):
		await self.send(text_data=json.dumps({
			"type": "block_user",
			"block_type": event["block_type"],
			"blocker_id": event["blocker_id"],
			"blocker_username": event["blocker_username"]
		}))

	@database_sync_to_async
	def get_game_results(self, message):
		#Récupère les résultats de la partie.
		return {
			'winners': message.play.results.get('winners', []),
			'losers': message.play.results.get('losers', []),
			'score': message.play.results.get('score', []),
		}

	async def wait_for_game_to_finish(self, destinataire, message):
		# Attendre que la partie soit terminée
		await sync_to_async(message.play.refresh_from_db)()

		# Tentatives pour récupérer les résultats
		attempts = 0
		max_attempts = 5  # Nombre maximal d'essais

		while True:
			# Rafraîchir l'objet Play depuis la base de données
			await sync_to_async(message.play.refresh_from_db)()

			# Vérifier si la partie est terminée
			if message.play.is_finished:
				break

			# Attendre 1 seconde avant de vérifier à nouveau
			await asyncio.sleep(1)

		# Tentatives pour obtenir les résultats
		results = None  # Initialisation de results
		while attempts < max_attempts:
			await sync_to_async(message.play.refresh_from_db)()
			try:
				print(f"\n\ntentative de recuperation des resultat numero {attempts}\n game_id = ", message.play.id)
				results = await self.get_game_results(message)
				
				# Si les résultats sont valides (non vide), on peut sortir de la boucle
				if results['winners'] or results['losers'] or results['score']:
					break
			except Exception as e:
				print(f"\n\nErreur lors de l'utilisation de get_game_results : {e}", flush=True)
				message_data = {
					"style": "jeu",
					"expediteur_id": destinataire.id,
					"expediteur_username": destinataire.username,
					"destinataire_id": self.user.id,
					"destinataire_username": self.user.username,
					"message_id": message.id,
					"message": "erreur resultats partie",
					"gameId": message.play.id,
					"date": message.date.isoformat()  # Utilisation de isoformat() pour la date
				}

				await sync_to_async(setattr)(message, 'message', "erreur resultats partie")
				await sync_to_async(message.save)()

				await self.send(text_data=json.dumps({
					"type": "pong_invitation",
					"message": message_data
				}))

				await self.channel_layer.group_send(
					f"user_{destinataire.id}",
					{
						"type": "pong_invitation_resultats_event",
						"message_data": message_data
					})
			
			# Si les résultats ne sont toujours pas récupérés, attendre 1 seconde et réessayer
			attempts += 1
			if attempts < max_attempts:
				await asyncio.sleep(1)

		# Si après max_attempts, les résultats sont toujours absents, lever une erreur
		if attempts == max_attempts and (not results or not (results['winners'] or results['losers'] or results['score'])):
			raise ValueError("Les résultats du jeu sont introuvables après plusieurs tentatives.")

		winners = results['winners']
		losers = results['losers']
		score = results['score']

		message_data = {
			"style": "jeu",
			"expediteur_id": destinataire.id,
			"expediteur_username": destinataire.username,
			"destinataire_id": self.user.id,
			"destinataire_username": self.user.username,
			"message_id": message.id,
			"message": "resultats partie",
			"gameId": message.play.id,
			'winners': winners,
			'losers': losers,
			'score': score,
			"date": message.date.isoformat()  # Utilisation de isoformat() pour la date
		}

		await sync_to_async(setattr)(message, 'message', "resultats partie")
		await sync_to_async(message.save)()

		await self.send(text_data=json.dumps({
			"type": "pong_invitation",
			"message": message_data
		}))

		await self.channel_layer.group_send(
			f"user_{destinataire.id}",
			{
				"type": "pong_invitation_resultats_event",
				"message_data": message_data
			})
		
	async def pong_invitation_resultats_event(self, event):
		await self.send(text_data=json.dumps({
			"type": "pong_invitation",
			"message": event["message_data"]
		}))
