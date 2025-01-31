FROM python:3.10-slim

# Mettre à jour les paquets système et installer les dépendances
RUN apt-get update
#Utile surtout si on ajoute PostrgeSQL
#&& apt-get install -y libpq-dev gcc

#Répertoire de travail dans le conteneur (doit generalement etre le repertoire racine ou se trouve manage.py)
WORKDIR /app

# Copier le fichier requirements.txt dans le conteneur
COPY requirements.txt .

# Installer les dépendances Python
RUN pip install -r requirements.txt

# Copier le reste du code source dans le conteneur
COPY . .

# Collecter les fichiers statiques
RUN python manage.py collectstatic --noinput

#Ajout des fichiers de migrations dans le container a la construction de l'image
#(Si on decide ne pas partager les fichier de migrations pour la version final du projet)
RUN python manage.py makemigrations

# Exposer le port sur lequel Daphne va écouter (8000 par défaut)
EXPOSE 8000

# Executez les migrations et Démarrer Daphne pour servir l'application
CMD ["bash", "-c", "python manage.py migrate && daphne -b 0.0.0.0 -p 8000 Transcendance.asgi:application"]

