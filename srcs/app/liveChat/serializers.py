from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import User, Message

class MessageSerializer(serializers.ModelSerializer):
    expediteur = serializers.CharField(source='expediteur.username')
    class Meta:
        model = Message
        fields = ['expediteur', 'message', 'date']
