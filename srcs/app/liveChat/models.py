from django.db import models
from authentication.models import User
from game.models import Play

# Create your models here.

class Conversation(models.Model):
    user_1 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations_expediteur')
    user_2 = models.ForeignKey(User, on_delete=models.CASCADE, related_name='conversations_destinataire')

    invitationAJouer = models.BooleanField(default=False)
    # nouveauxMessages = models.BooleanField(default=False)

    def __str__(self):
        return f'Conversation entre {self.user_1} et {self.user_2}'

class Message(models.Model):
    MESSAGE_STYLE_CHOICES = [
        ('message', 'Message'),
        ('jeu', 'Invitation à jouer'),
    ]
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    style = models.CharField(max_length=10, choices=MESSAGE_STYLE_CHOICES, default='message')
    expediteur = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages_expediteur')
    destinataire = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages_destinataire')
    message = models.TextField(max_length=200)
    date = models.DateTimeField(auto_now_add=True)
    lu = models.BooleanField(default=False)
    play = models.ForeignKey(Play, on_delete=models.CASCADE, null=True, blank=True, related_name='messages')  # Relation optionnelle avec Play

    def __str__(self):
        return f'{self.expediteur} : {self.message}'
    
    class Meta:
        ordering = ['-date']

