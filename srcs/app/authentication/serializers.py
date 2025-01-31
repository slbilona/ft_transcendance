import re
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.contrib.auth import authenticate
from django.contrib.auth import login
from django.contrib.auth.password_validation import validate_password
from authentication.models import User
import bleach

def clean_user_data(data):

	cleaned_data = {}
	for key, value in data.items():
		if isinstance(value, str):
			cleaned_data[key] = bleach.clean(value, tags=[], attributes=[], strip=True)
		else:
			cleaned_data[key] = value
	return cleaned_data

class UserSerializer(serializers.ModelSerializer):
	class Meta:
		model = User
		fields = ['id', 'username', 'alias', 'email', 'nbPartiesJouees', 'nbVictoires', 'nbDefaites', 'photoProfile']

class PublicUserSerializer(serializers.ModelSerializer):
	class Meta:
		model = User
		fields = ['username', 'alias', 'nbPartiesJouees', 'nbVictoires', 'nbDefaites', 'photoProfile', 'onlineStatus']

#Verification des données fournies lors de la connexions
# class LoginSerializer(serializers.Serializer):
# 	username = serializers.CharField(required=True)
# 	alias = serializers.CharField(required=True)
# 	password = serializers.CharField(write_only=True, required=True)

# 	def validate(self, data):
# 		username = data.get('username')
# 		alias = data.get('alias')
# 		password = data.get('password')

# 		User = get_user_model()
# 		try:
# 			user = User.objects.get(username=username, alias=alias)
# 		except User.DoesNotExist:
# 			raise serializers.ValidationError("Identifiant invalide.")

# 		if not user.check_password(password):
# 			raise serializers.ValidationError("Mot de passe invalide.")

# 		return {
# 			'user': user
# 		}

class LoginSerializer(serializers.Serializer):

	username = serializers.CharField(required=True)
	password = serializers.CharField(write_only=True, required=True)

	def validate(self, data):

		data = clean_user_data(data)  # Protection contre les injections XSS

		username = data.get('username')
		password = data.get('password')

		User = get_user_model()
		try:
			user = User.objects.get(username=username)
		except User.DoesNotExist:
			raise serializers.ValidationError("Identifiant invalide.")

		if not user.check_password(password):
			raise serializers.ValidationError("Mot de passe invalide.")

		return {
			'user': user
		}

# verification des données fournies lors de l'inscription
# /!\ ajouter la photo de profil
class SignupSerializer(serializers.ModelSerializer):
	username = serializers.CharField(required=True)
	alias = serializers.CharField(required=True)
	email = serializers.EmailField(required=True)
	password = serializers.CharField(write_only=True, required=True)
	photoProfile = serializers.ImageField(required=False)

	class Meta:
		model = get_user_model()
		fields = ['username', 'alias', 'email', 'password', 'photoProfile']

	def validate_password(self, value):
		validate_password(value)
		return value

	def validate(self, data):

		data = clean_user_data(data)  # Protection contre les injections XSS

		username = data.get('username')
		alias = data.get('alias')
		email = data.get('email')
		password = data.get('password')
		user = get_user_model()
		if user.objects.filter(email=email).exists():
			raise serializers.ValidationError("Cet email est deja utilisé.")
		if user.objects.filter(username=username).exists():
			raise serializers.ValidationError("Ce nom d'utilisateur est deja utilisé.")
		# if user.objects.filter(alias=alias).exists():
		# 	raise serializers.ValidationError("Cet alias est deja utilisé.")
		if len(password) < 8 or not re.search("[a-z]", password) or not re.search("[A-Z]", password) or not re.search("[0-9]", password) or not re.search("[.@,#$%^&+=!_-]", password):
			raise serializers.ValidationError("Le mot de passe ne répond pas aux critères.")
		return data

	def create(self, validated_data):
		password = validated_data.pop('password')
		user = get_user_model().objects.create(**validated_data)
		user.set_password(password)
		user.save()
		return user

class UserUpdateSerializer(serializers.ModelSerializer):
	password = serializers.CharField(write_only=True, required=False)

	# photoProfile = serializers.ImageField(required=False, allow_null=True)

	class Meta:
		model = User
		fields = ['username', 'alias', 'email', 'photoProfile', 'password']
		extra_kwargs = {
            'username': {'required': False},
            'alias': {'required': False},
            'email': {'required': False},
            'password': {'write_only': True, 'required': False},
		}

	def validate(self, data):
		data = clean_user_data(data)  # Protection contre les injections XSS
		return data

	def validate_password(self, value):
		if value and (len(value) < 8 or not re.search("[a-z]", value) or not re.search("[A-Z]", value) or not re.search("[0-9]", value) or not re.search("[.@,#$%^&+=!_\-]", value)):
			raise serializers.ValidationError("Le mot de passe ne répond pas aux critères.")
		return value

	def update(self, instance, validated_data):
		validated_data = {key: value for key, value in validated_data.items() if value not in ["", None]}
		password = validated_data.pop('password', None)
		# validated_data = {key: value for key, value in validated_data.items() if value not in ["", None]}
		for attr, value in validated_data.items():
			setattr(instance, attr, value)
		if password:
			self.validate_password(password)
			instance.set_password(password)
		instance.save()
		if password:
			login(self.context['request'], instance)
		return instance
