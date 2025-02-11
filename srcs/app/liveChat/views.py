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
            user = request.user
            
            # Récupérer les conversations
            conversations = Conversation.objects.filter(Q(user_1=user) | Q(user_2=user))
            conversation_users = set()
            conversation_data = []
            
            for conversation in conversations:
                if conversation.user_1 == user:
                    contact = conversation.user_2
                else:
                    contact = conversation.user_1
                
                conversation_users.add(contact.id)
                conversation_data.append({
                    "username": contact.username,
                    "id": contact.id,
                    "online": contact.onlineStatus
                })
            
            # Récupérer les following
            following = user.following.all()
            following_data = []
            
            for followed in following:
                if followed.id not in conversation_users:  # Éviter les doublons
                    following_data.append({
                        "username": followed.username,
                        "id": followed.id,
                        "online": followed.onlineStatus
                    })
            
            return Response({
                "conversations": conversation_data,
                "following": following_data
            }, status=status.HTTP_200_OK)
        
        except Exception as e:
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


