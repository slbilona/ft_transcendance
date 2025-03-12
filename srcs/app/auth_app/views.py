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

@csrf_exempt
def callback_42(request):
    """ Récupère le token OAuth, crée l'utilisateur et le connecte """
    code = request.GET.get("code")
    if not code:
        print("❌ Aucune valeur `code` reçue dans la requête.")
        return JsonResponse({"error": "No code provided"}, status=400)

    print(f"🔹 Code reçu depuis 42 : {code}")

    # 🔹 Échange du "code" contre un "token"
    token_url = "https://api.intra.42.fr/oauth/token"
    data = {
        "grant_type": "authorization_code",
        "client_id": "u-s4t2ud-9205acb50a60acab23b1002029b1bc11dfcfe3fd6005acbcfb70bc457ffce2a6",  # ✅ Récupéré depuis settings.py
        "client_secret": "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",  # ✅ Récupéré depuis settings.py
        "code": code,
        "redirect_uri": "https://localhost:8443/login/callback/",
    }

    response = requests.post(token_url, data=data)
    
    print("🔹 Réponse API 42:", response.status_code, response.text)
    
    if response.status_code != 200:
        print("❌ Erreur lors de la récupération du token:", response.json())
        return JsonResponse({"error": "Failed to get token"}, status=400)

    access_token = response.json().get("access_token")
    print(f"🔹 Token reçu : {access_token}")

    # 🔹 Récupère les infos de l'utilisateur avec le token
    user_info_url = "https://api.intra.42.fr/v2/me"
    headers = {"Authorization": f"Bearer {access_token}"}
    user_info_response = requests.get(user_info_url, headers=headers)

    if user_info_response.status_code != 200:
        print("❌ Erreur lors de la récupération des infos utilisateur:", user_info_response.json())
        return JsonResponse({"error": "Failed to fetch user info"}, status=400)

    user_data = user_info_response.json()
    username = user_data.get("login")
    email = user_data.get("email")

    print(f"🔹 Infos utilisateur reçues : username={username}, email={email}")

    # 🔹 Vérifie si l'utilisateur existe, sinon le crée
    user, created = User.objects.get_or_create(username=username, defaults={"email": email})
    
    if created:
        # 🔹 Génère un mot de passe aléatoire car on utilise OAuth
        random_password = ''.join(random.choices(string.ascii_letters + string.digits, k=16))
        user.set_password(random_password)
        user.save()
        print(f"🆕 Nouvel utilisateur créé: {username}")

    # 🔹 Connecte automatiquement l'utilisateur
    login(request, user)

    print(f"✅ Utilisateur connecté : {user}")

    return JsonResponse({"success": True, "username": username, "email": email})
