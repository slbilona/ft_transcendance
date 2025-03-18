from django.http import HttpResponse
from django.shortcuts import render
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError, MethodNotAllowed
from rest_framework.response import Response
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action

from game.models import Play, Tournament
from game.serializer import PlayCreateSerializer, PlayDetailSerializer, PlayListSerializer
from game.serializer import TournamentSerializer
# Create your views here.


def index(request):
	context = {
		"contract_adress": settings.CONTRACT_ADDRESS,
		"alchemy_rpc": settings.ALCHEMY_RPC,
	}

	return render(request, 'game/index.html', context)

#APIView pour des actions specifiques
#ModelViewset pour les operations CRUD directement liee a un model

#Expose un endpoint pour creer une partie. L'ID de la partie cree peut etre utilise pour se connecter a la partie pour le client
#La ValidationError raise implique que DRF repond automatiquement une 400 Bad Request (Utile pour des erreurs de validation simple)
class PlayCreateAPIView(APIView):
	def post(self, request):
		#Pre validation pour eviter des operations plus couteuses si les fields requis ne sont pas present
		if 'remote' not in request.data or 'nb_players' not in request.data or 'private' not in request.data:
			raise ValidationError('remote and nb_players and private are required')

		#[ Autre option ] Extraire manuellement les donnees de la requete pour pouvoir creer un objet puis le mettre dans un serializer
		# remote = request.data.get('remote')
		#Recuperer les donnees depuis la requete directement grace au serializer pour simplifier la vue
		serializer = PlayCreateSerializer(data=request.data)
		if serializer.is_valid(raise_exception=True):
			if request.user.is_authenticated:
				serializer.save(player1=request.user)
			else :
				serializer.save()
			return Response(serializer.data, status=status.HTTP_201_CREATED)
		#Reponse BAD_REQUEST generee automatiquement dans la validation du serializer

#Ici on leve des exception relative a des acces externe comme la base de donnees ou les serializers (donc bloc try / except)
class PlayDetailAPIView(APIView):
	def get(self, request, *args, **kwargs):
		try:
			play_id = kwargs.get('play_id')
			play = Play.objects.get(pk=play_id)
		except Play.DoesNotExist:
			return Response({'error': 'Play object not found'}, status=status.HTTP_404_NOT_FOUND)
		except (ValueError, TypeError):
			return Response({'error': 'url required play_id'}, status=status.HTTP_400_BAD_REQUEST)
		except Exception as e:
			return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
		serializer = PlayDetailSerializer(play)
		return Response(serializer.data, status=status.HTTP_200_OK)

#Cet API permet de relier un User dans l'objet Partie. Il doit etre utilise en ce sens
#Sauf lorsque un User connecte cree une partie, il est directement connecte en tant que player1 dans la partie
class PlaySubscribeAPIView(APIView):
	def put(self, request, *args, **kwargs):
		try:
			play_id = kwargs.get('play_id')
			play = Play.objects.get(pk=play_id)
		except Play.DoesNotExist:
			return Response({'error': 'Play object not found'}, status=status.HTTP_404_NOT_FOUND)
		except (ValueError, TypeError):
			return Response({'error': 'url required play_id'}, status=status.HTTP_400_BAD_REQUEST)
		except Exception as e:
			return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

		if request.user.is_authenticated:
			if not play.add_player(request.user):
				return Response({'error': 'app player to play failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
		return Response({'message': 'Player added successfully'},status=status.HTTP_200_OK)


#Pour la creation et la lecture des donnees d'une partie, j'ai opte pour une separation des taches avec un serializer et une vue pour chaque tache
#Ce choix est viable si peu d'actions sont exposees, et permet de garder un controle total en limitant l'exposition d'actions non desirees
#Pour les Tournois, j'opte pour un viewSet avec actions limites ce qui permet de centraliser la logique et reduire la taille du code
class TournamentViewSet(viewsets.ModelViewSet):

	queryset = Tournament.objects.all()
	serializer_class = TournamentSerializer

	def update(self, request, *args, **kwargs):
		raise MethodNotAllowed('PUT')

	def partial_update(self, request, *args, **kwargs):
		raise MethodNotAllowed('PATCH')

	def destroy(self, request, *args, **kwargs):
		raise MethodNotAllowed('DELETE')

	#Decorateur permettant une action personnalisee dans un ViewSet
	#detail = S'applique a un objet en particulier
	#url_path le path a utiliser pour acceder a l'API
	#url_name specifier dans les urls via la methode reverse()
	@action(detail=True, methods=['get'], url_path='next-play', url_name='next_play')
	def next_play(self, request, pk=None):
		try:
			tournament = self.get_object()#methode de ViewSet qui recupere l'objet
		except Tournament.DoesNotExist:
			return Response({'error': 'Tournament Not Found'}, status=status.HTTP_404_NOT_FOUND)
		if tournament.is_finished:
			return Response({'message': 'Tournament is finished'}, status=status.HTTP_410_GONE)
		#Recupere toute les parties associees au tournoi
		plays = Play.objects.filter(tournament=tournament, tournament_round=tournament.current_round, is_finished=False)
		next_play = plays.first()
		if next_play:#Si il y a des parties a jouer
			return Response({'play_id':next_play.id,
					'players': [next_play.player1.alias, next_play.player2.alias]
					}, status=status.HTTP_200_OK)
		else :#Si les parties du current_round ont toutes ete jouees
			#create next round (Ajouter une logique se si la finale a ete jouer stocker le score et mettre is_finished a True)
			tournament.create_next_round()
			if not tournament.is_finished:
				plays = Play.objects.filter(tournament=tournament, tournament_round=tournament.current_round, is_finished=False)
				next_play = plays.first()
				return Response({'play_id':next_play.id,
					'players': [next_play.player1.alias, next_play.player2.alias]
					}, status=status.HTTP_200_OK)
			else:
				return Response({'message': 'Tournament is finished'}, status=status.HTTP_410_GONE)

class PlayListAPIView(APIView):
	def get(self, request):
		plays = Play.objects.filter(remote=True, is_finished=False, private=False)
		serializer = PlayListSerializer(plays, many=True)
		return Response(serializer.data)