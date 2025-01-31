from rest_framework.views import APIView
from django.shortcuts import render
from rest_framework.response import Response
from rest_framework import status
from .models import Message, Conversation
from .serializers import MessageSerializer
from rest_framework.permissions import IsAuthenticated
from rest_framework.authentication import SessionAuthentication
from authentication.models import User
from django.db.models import Q
from authentication.serializers import UserSerializer

class MessageHistory(APIView):
	authentication_classes = [SessionAuthentication]  # Utilise la session pour vérifier si l'utilisateur est connecté
	permission_classes = [IsAuthenticated]  # Autorise uniquement les utilisateurs authentifiés

	def get(self, request, id):
		try:
			# Récupérer l'utilisateur connecté
			user_1 = request.user

			# Vérification si l'utilisateur 2 existe
			try:
				user_2 = User.objects.get(id=id)
			except User.DoesNotExist:
				return Response(
					{"error": f"L'utilisateur avec l'id {id} n'existe pas."},
					status=status.HTTP_404_NOT_FOUND
				)

			# Vérification si user_2 est bloqué par user_1
			unBloqueDeux = user_1.blockedUser.filter(id=user_2.id).exists()
			deuxBloqueUn = user_2.blockedUser.filter(id=user_1.id).exists()

			# Recherche de la conversation
			conversation = Conversation.objects.filter(
				(Q(user_1=user_1) & Q(user_2=user_2)) | (Q(user_1=user_2) & Q(user_2=user_1))
			).first()

			# Si une conversation existe, récupérer les messages
			if conversation:
				messages = Message.objects.filter(conversation=conversation).order_by('date')
				messages_data = [
					{
						"style": message.style,
						"expediteur_username": message.expediteur.username,
						"destinataire_username": message.destinataire.username,
						"expediteur_id": message.expediteur.id,
						"destinataire_id": message.destinataire.id,
						"message": message.message,
						"date": message.date,
						"lu": message.lu,
						"message_id": message.id,
						**({
							"winners": message.play.results.get('winners', []),
							"losers": message.play.results.get('losers', []),
							"score": message.play.results.get('score', None)
						} if message.style == "jeu" and getattr(message, 'play', None) and message.play.is_finished else {})
					}
					for message in messages
				]
				return Response({
					"messages": messages_data,
					"destinataire_onlineStatus": user_2.onlineStatus,
					"1bloque2": unBloqueDeux,
					"2bloque1": deuxBloqueUn
				}, status=status.HTTP_200_OK)
			else:
				# Si aucune conversation trouvée
				return Response({
					"noConversation": f"Aucune conversation trouvée entre {user_1.username} et {user_2.username}.",
					"destinataire_onlineStatus": user_2.onlineStatus,
					"destinataire": user_2.username,
					"1bloque2": unBloqueDeux,
					"2bloque1": deuxBloqueUn
				}, status=status.HTTP_200_OK)

		except Exception as e:
			# Gestion d'autres erreurs inattendues
			return Response(
				{"error": f"Erreur inattendue : {str(e)}"},
				status=status.HTTP_500_INTERNAL_SERVER_ERROR
			)
		
class listeConversation(APIView):
	authentication_classes = [SessionAuthentication]
	permission_classes = [IsAuthenticated]

	def get(self, request):
		try:
			# Vérifiez si l'utilisateur est authentifié
			if not request.user.is_authenticated:
				return Response({"error": "Non connecté"}, status=status.HTTP_401_UNAUTHORIZED)

			user = request.user
			# Récupérez toutes les conversations où l'utilisateur est impliqué
			conversations = Conversation.objects.filter(Q(user_1=user) | Q(user_2=user))
			
			if conversations.exists():
				conversation_data = []
				for conversation in conversations:
					if conversation.user_1 == user:
						username = conversation.user_2.username
						user_id = conversation.user_2.id
						online = getattr(conversation.user_2, 'onlineStatus', False)
					else:
						username = conversation.user_1.username
						user_id = conversation.user_1.id
						online = getattr(conversation.user_1, 'onlineStatus', False)
					
					conversation_data.append({
						"username": username,
						"id": user_id,
						"online": online
					})
				
				return Response({"conversations": conversation_data}, status=status.HTTP_200_OK)
			else:
				# Aucun résultat trouvé
				return Response({"error": "aucune conversation trouvée"}, status=status.HTTP_200_OK)

		except Exception as e:
			# Capturez et renvoyez l’erreur avec le statut HTTP 500
			return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class listeUtilisateurs(APIView):
	authentication_classes = [SessionAuthentication]
	permission_classes = [IsAuthenticated]
	
	def get(self, request):
		search_query = request.GET.get('search', '').strip()  # Enlever les espaces inutiles
		
		# Récupérer l'utilisateur connecté
		utilisateur_connecte = request.user
		
		# Filtrer les utilisateurs selon la recherche (par préfixe) et exclure l'utilisateur connecté
		utilisateurs = (
			User.objects.filter(username__istartswith=search_query) |
			User.objects.filter(alias__istartswith=search_query)
		).exclude(id=utilisateur_connecte.id)  # Exclure l'utilisateur connecté
		
		# Sérialiser les données des utilisateurs en utilisant UserSerializer
		serializer = UserSerializer(utilisateurs, many=True)
		
		# Retourner les données sérialisées
		return Response(serializer.data)


