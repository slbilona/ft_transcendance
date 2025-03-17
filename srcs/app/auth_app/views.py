import requests
import random
import string
from django.shortcuts import redirect, render
from django.http import JsonResponse
from django.conf import settings
from django.contrib.auth import login, get_user_model
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth.decorators import login_required

# Récupère le modèle User personnalisé
User = get_user_model()

@login_required
def welcome(request):
	""" Page d'accueil après connexion """
	return render(request, "srcs/app/game/templates/game/index.html")

def login_page(request):
	""" Page de connexion """
	return render(request, "auth_app/login.html")

def get_42_auth_url(request):
	""" Génère l'URL d'authentification 42 et l'envoie au front """
	auth_url = (
		"https://api.intra.42.fr/oauth/authorize"
		f"?client_id={settings.FORTYTWO_CLIENT_ID}"
		f"&redirect_uri={settings.FORTYTWO_REDIRECT_URI}"
		"&response_type=code"
	)
	return JsonResponse({'url': auth_url})

def login_with_42(request):
	""" Redirige l'utilisateur vers l'authentification 42 """
	auth_url = (
		"https://api.intra.42.fr/oauth/authorize"
		f"?client_id={settings.FORTYTWO_CLIENT_ID}"
		f"&redirect_uri={settings.FORTYTWO_REDIRECT_URI}"
		"&response_type=code"
	)
	return redirect(auth_url)

import os
import requests
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
@csrf_exempt
def callback_42(request):
	# Récupère le code de l'authentification
	code = request.GET.get("code")
	if not code:
		return JsonResponse({"error": "No code provided"}, status=400)

	# Échange du code contre un token
	token_url = "https://api.intra.42.fr/oauth/token"
	data = {
		"grant_type": "authorization_code",
		"client_id": settings.FORTYTWO_CLIENT_ID,
		"client_secret": settings.FORTYTWO_CLIENT_SECRET,
		"code": code,
		"redirect_uri": settings.FORTYTWO_REDIRECT_URI,
	}
	response = requests.post(token_url, data=data)
	if response.status_code != 200:
		return JsonResponse({"error": "Failed to get token"}, status=400)

	access_token = response.json().get("access_token")

	# Récupère les informations de l'utilisateur avec le token
	user_info_url = "https://api.intra.42.fr/v2/me"
	headers = {"Authorization": f"Bearer {access_token}"}
	user_info_response = requests.get(user_info_url, headers=headers)

	if user_info_response.status_code != 200:
		return JsonResponse({"error": "Failed to fetch user info"}, status=400)

	user_data = user_info_response.json()
	username_42 = user_data.get("login")
	email = user_data.get("email")
	profile_pic_url = user_data.get("image", {}).get("link")  # Récupère l'image

	# Recherche l'utilisateur via `username_42`
	user = User.objects.filter(username_42=username_42).first()

	if not user:
		# Crée un nouvel utilisateur
		unique_username = username_42
		counter = 1
		while User.objects.filter(username=unique_username).exists():
			unique_username = f"{username_42}{counter}"
			counter += 1

		unique_alias = username_42
		counter = 1
		while User.objects.filter(alias=unique_alias).exists():
			unique_alias = f"{username_42}{counter}"
			counter += 1

		user = User.objects.create(
			username=unique_username,
			email=email if not User.objects.filter(email=email).exists() else None,
			alias=unique_alias,
			username_42=username_42,
			userVia42 = True
		)

		# Télécharge et sauvegarde l'image de profil
		if profile_pic_url:
			filename = f"profile_pics/{username_42}.jpg"
			response = requests.get(profile_pic_url)
			if response.status_code == 200:
				file_content = ContentFile(response.content)
				user.photoProfile.save(filename, file_content, save=True)

		# Génère un mot de passe aléatoire
		random_password = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
		user.set_password(random_password)
		user.save()


	# Connecte l'utilisateur
	login(request, user)

	return redirect("https://localhost:8443/game/")