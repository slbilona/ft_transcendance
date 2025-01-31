from django.contrib import admin
from .models import Message, Conversation  # Importez Conversation ici
from authentication.models import User

class MessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'message', 'date')  # Champs à afficher
    search_fields = ('message',)  # Recherche par contenu des messages
    list_filter = ('date',)  # Filtrer par date

class ConversationAdmin(admin.ModelAdmin):
    list_display = ('id', 'user_1', 'user_2')  # Champs à afficher
    search_fields = ('user_1_username', 'user_2_username')  # Recherche par nom d'utilisateur

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'id', 'email')
    search_fields = ('username', 'email')

# Enregistre les modèles avec l'interface d'administration personnalisée
admin.site.register(Message, MessageAdmin)
admin.site.register(Conversation, ConversationAdmin)  # Enregistre le modèle Conversation
