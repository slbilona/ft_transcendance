import logging
import os
from django.shortcuts import render
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.contrib.auth import login, logout
from django.contrib.auth import get_user_model
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.db.models import Q #Fourni par Django pour permettre de combiner des requetes SQL complexes
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
# , viewsets, permissions
from authentication.models import User
from authentication.serializers import LoginSerializer, UserSerializer, SignupSerializer, UserUpdateSerializer, PublicUserSerializer
from game.models import Play
from game.serializer import PlayDetailSerializer

# Create your views here.

logger = logging.getLogger(__name__)

from django.http import JsonResponse
from django.middleware.csrf import get_token
from django.views.decorators.http import require_GET

@require_GET
def get_csrf_token(request):
	return JsonResponse({'csrfToken': get_token(request)})

#APIView pour des actions specifiques
#ModelViewset pour les operations CRUD directement liee a un model

class UserInfoAPI(APIView):
	def get(self, request):
		if request.user.is_authenticated:
			return Response({
				'alias': request.user.alias,
				'username': request.user.username,
				'email': request.user.email,
				'photoProfile': request.user.photoProfile.url if request.user.photoProfile else None,
			})
		else:
			return Response({'message': 'Not authenticated'}, status=status.HTTP_401_UNAUTHORIZED)

from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from django.contrib.auth import login

class LoginAPI(APIView):
	def post(self, request):
		serializer = LoginSerializer(data=request.data)
		if serializer.is_valid():
			user = serializer.validated_data['user']  # Utilisateur authentifié
			login(request, user)
			user_data = UserSerializer(user).data

			return Response({
				"success": True,
				"message": "Connexion réussie",
				"user": user_data
			}, status=status.HTTP_200_OK)

		return Response({
			"success": False,
			"message": "Échec de la connexion",
			"errors": serializer.errors
		}, status=status.HTTP_400_BAD_REQUEST)

class SignupAPI(APIView):
	def post(self, request):
		serializer = SignupSerializer(data=request.data)
		if serializer.is_valid():
			user = get_user_model()(
				username=serializer.validated_data['username'],
				email=serializer.validated_data['email'],
				alias=serializer.validated_data['alias'],
			)

			user.set_password(serializer.validated_data['password'])

			if 'photoProfile' in request.FILES:
							photo = request.FILES['photoProfile']
							filename = f'{user.username}.jpg'
							filepath = os.path.join(settings.MEDIA_ROOT, filename)  # Enregistrement dans le dossier MEDIA_ROOT

							with open(filepath, 'wb+') as destination:
								for chunk in photo.chunks():
									destination.write(chunk)

							user.photoProfile = f'{filename}'  # Pas de sous-dossier, juste le fichier

			user.save()
			login(request, user)
			user_data = UserSerializer(user).data
			return Response({
				"message": "Inscription réussie",
				"user": user_data
			}, status=status.HTTP_201_CREATED)
		else:
			logger.error(f"Validation errors: {serializer.errors}")
		return Response({
				"errors": serializer.errors
			}, status=status.HTTP_400_BAD_REQUEST)

class Logout(APIView):
	def get(self, request):
		logout(request)
		return Response({"message": "Déconnexion réussie"}, status.HTTP_200_OK)

class UserDetailView(APIView):
	def get(self, request, username):
		user = get_object_or_404(User, username=username)
		serializer = PublicUserSerializer(user)
		data = serializer.data
		data['id'] = user.id
		return Response(data)

class UserProfileView(APIView):
	permission_classes = [IsAuthenticated]
	def get(self, request, user_id=None):
		if user_id:
			user = get_object_or_404(User, id=user_id)
		else:
			user = request.user
		if user == request.user:
			serializer = UserSerializer(user)
		else:
			serializer = PublicUserSerializer(user)
		return Response(serializer.data)

#ListAPIView gere les requetes de type List et Pagination
class MatchHistoryView(generics.ListAPIView):

	serializer_class = PlayDetailSerializer #Specifie a ListAPIView comment serializer les donnees
	permission_classes = [IsAuthenticated]
	#pagination_class = #Specifier dans les settings par defaut mais personnalisable comme ceci
	#Cette methode specifie comment recuperer les donnees
	#Une fois fait, DRF utilisera serializer_class pour serialiser les donnees recuperees

	def get_queryset(self):
		#Cas si on autorise de consulter le Match History d'autres joueurs (Mettre condition d'ami)
		# user_id = self.kwargs.get('user_id', None)
		# if user_id:
		# 	user = User.objects.get(pk=user_id)
		# else:
		user = self.request.user
		return Play.objects.filter(
			(Q(player1=user) |
			Q(player2=user) |
			Q(player3=user) |
			Q(player4=user)) &
			Q(is_finished=True)
		).order_by('-date')
		#La pagination est faites automatiquement par DRF grace a la reqquete qui contient des parametres sur la pages souhaitees
		# return Play.objects.filter(
		#     (Q(player1=user) |
		#      Q(player2=user) |
		#      Q(player3=user) |
		#      Q(player4=user)) &
		#     Q(is_finished=True)
		# ).order_by('-date')

class UserProfileUpdateView(APIView):
	permission_classes = [IsAuthenticated]
	def get(self, request):
		user = request.user
		serializer = UserUpdateSerializer(user)
		return Response(serializer.data)

	def put(self, request):
		user = request.user
		old_username = user.username
		serializer = UserUpdateSerializer(user, data=request.data, partial=True, context={'request': request})

		if serializer.is_valid():
			# Gérer le changement de photo de profil
			if 'photoProfile' in request.FILES:
				photo = request.FILES['photoProfile']
				old_filename = f'{old_username}.jpg'
				new_filename = f'{user.username}.jpg'
				old_filepath = os.path.join(settings.MEDIA_ROOT, old_filename)
				new_filepath = os.path.join(settings.MEDIA_ROOT, new_filename)

				# Supprimer l'ancienne photo si elle existe
				if os.path.exists(old_filepath):
					os.remove(old_filepath)

				# Enregistrer la nouvelle photo
				with open(new_filepath, 'wb+') as destination:
					for chunk in photo.chunks():
						destination.write(chunk)

				# Mettre à jour le chemin de la photo de profil
				user.photoProfile = f'{new_filename}'
				user.save()

			# Si le nom d'utilisateur change, renommer la photo de profil
			if 'username' in serializer.validated_data and serializer.validated_data['username'] != old_username:
				old_filename = f'{old_username}.jpg'
				new_filename = f'{serializer.validated_data["username"]}.jpg'
				old_filepath = os.path.join(settings.MEDIA_ROOT, old_filename)
				new_filepath = os.path.join(settings.MEDIA_ROOT, new_filename)

				# Renommer le fichier si l'ancienne photo existe
				if os.path.exists(old_filepath):
					os.rename(old_filepath, new_filepath)
					user.photoProfile = f'{new_filename}'
					user.save()

			# Save the user with the serializer to update other fields
			user_updated = serializer.save()

			return Response(UserSerializer(user_updated).data, status=status.HTTP_200_OK)

		return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class UserDeleteView(APIView):
	permission_classes = [IsAuthenticated]
	def delete(self, request):
		user = request.user
		user.delete()
		return Response(status=status.HTTP_204_NO_CONTENT)

class AddFriendView(APIView):
	permission_classes = [IsAuthenticated]
	def post(self, request, user_id):
		user_to_follow = get_object_or_404(User, id=user_id)
		if request.user == user_to_follow:
			return Response({"detail": "Vous ne pouvez pas vous suivre vous-même."},
						  status=status.HTTP_400_BAD_REQUEST)

		# Vérifier si l'utilisateur est déjà dans la liste des following
		if user_to_follow in request.user.following.all():
			return Response({"detail": "Vous suivez déjà cet utilisateur."},
						  status=status.HTTP_400_BAD_REQUEST)

		request.user.following.add(user_to_follow)
		return Response({
			"detail": f"Vous suivez maintenant {user_to_follow.username}.",
			"user": {
				"id": user_to_follow.id,
				"username": user_to_follow.username
			}
		}, status=status.HTTP_200_OK)

class SuppFriendView(APIView):
	permission_classes = [IsAuthenticated]
	def delete(self, request, user_id):
		user_to_unfollow = get_object_or_404(User, id=user_id)

		# Vérifier si l'utilisateur est bien dans la liste des following
		if user_to_unfollow not in request.user.following.all():
			return Response({"detail": "Vous ne suivez pas cet utilisateur."},
						  status=status.HTTP_400_BAD_REQUEST)

		request.user.following.remove(user_to_unfollow)
		return Response({
			"detail": f"Vous ne suivez plus {user_to_unfollow.username}.",
			"user_id": user_id
		}, status=status.HTTP_200_OK)

class FollowingListView(APIView):
	permission_classes = [IsAuthenticated]
	def get(self, request):
		following_users = request.user.following.all()
		following_data = [{
			"id": user.id,
			"username": user.username,
			"alias": user.alias,
			"photoProfile": user.photoProfile.url if user.photoProfile else None
		} for user in following_users]
		return Response(following_data, status=status.HTTP_200_OK)

class FollowersListView(APIView):
	permission_classes = [IsAuthenticated]
	def get(self, request):
		followers_users = request.user.followers.all()
		followers_data = [{
			"id": user.id,
			"username": user.username,
			"alias": user.alias,
			"photoProfile": user.photoProfile.url if user.photoProfile else None
		} for user in followers_users]
		return Response(followers_data, status=status.HTTP_200_OK)

class BloquerUtilisateurView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request, id, *args, **kwargs):
		user_to_block = get_object_or_404(User, id=id)
		current_user = request.user

		if current_user == user_to_block:
			return Response({"error": "Vous ne pouvez pas vous bloquer vous-même."}, status=400)

		current_user.blockedUser.add(user_to_block)
		current_user.save()
		return Response({"message": f"L'utilisateur {user_to_block.username} a été bloqué avec succès."})
	
class DebloquerUtilisateurView(APIView):
	permission_classes = [IsAuthenticated]

	def post(self, request, id, *args, **kwargs):
		user_to_unblock = get_object_or_404(User, id=id)
		current_user = request.user

		if current_user == user_to_unblock:
			return Response({"error": "Vous ne pouvez pas vous débloquer vous-même."}, status=400)

		current_user.blockedUser.remove(user_to_unblock)
		current_user.save()
		return Response({"message": f"L'utilisateur {user_to_unblock.username} a été débloqué avec succès."})
	
class ProfilePictureRequest(APIView):
	permission_classes = [IsAuthenticated]

	def get(self, request, username, *args, **kwargs):
		user = get_object_or_404(User, username=username)
		if not user.photoProfile:
			photo_url =  "/static/images/base_pfp.png"
		else:
			photo_url = user.photoProfile.url
		return Response({"photoProfile": photo_url}, status=200)