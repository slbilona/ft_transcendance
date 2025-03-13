from django.urls import path
from .views import get_42_auth_url, login_with_42, callback_42, login_page, welcome

urlpatterns = [
    path('get-42-url/', get_42_auth_url, name='get_42_auth_url'),
    path('login-42/', login_with_42, name='login_42'),
    path('login/callback/', callback_42, name='callback_42'),
    path('login-page/', login_page, name='login_page'),
    path('welcome/', welcome, name='welcome'),
]




