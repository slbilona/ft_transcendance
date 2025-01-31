# Utiliser l'image officielle NGINX
FROM nginx:alpine

# Copier le fichier de configuration NGINX personnalisé dans le container
COPY nginx.conf /etc/nginx/conf.d/default.conf

#Copie des fichiers pour https dans le container
COPY certificate.crt /etc/nginx/ssl/certificate.crt
COPY private.key /etc/nginx/ssl/private.key

#Creation du repertoire dans le repertoire qui pourra acceder au certificat et a la cle privee
RUN mkdir -p /etc/nginx/certs

# Exposition du port 80 et 443 du container NGINX qui seront mappe au port 8080 et 8443 de la machine
# car 80 HTTP et 443 HTTPS sont des ports privilegies qui ne peuvent donc pas etre utilises
EXPOSE 80
EXPOSE 443




