# Utilise l'image officielle de PostgreSQL
FROM postgres:15

# Définir les variables d'environnement pour PostgreSQL
ENV POSTGRES_DB=mydb
ENV POSTGRES_USER=myuser
ENV POSTGRES_PASSWORD=mypassword

# Exposer le port PostgreSQL
EXPOSE 5432

# Utiliser un volume pour la persistance des données
VOLUME ["/var/lib/postgresql/data"]
