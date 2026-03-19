from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.register_user, name="register_user"),
    path("login/", views.login_user, name="login_user"),
    path("profile/", views.get_profile, name="get_profile"),
    path("logout/", views.logout, name="logout"),
    # Address management
    path("addresses/", views.manage_addresses, name="manage_addresses"),
    path("addresses/<int:address_id>/", views.address_detail, name="address_detail"),
    # Internal endpoint for inter-service communication
    path("internal/user/<str:user_id>/", views.internal_get_user, name="internal_get_user"),
    # Admin management endpoints
    path("admin/login/", views.admin_login, name="admin_login"),
    path("admin/register/", views.admin_register, name="admin_register"),
    path("admin/users/", views.admin_list_users, name="admin_list_users"),
    path("admin/users/<str:user_id>/", views.admin_delete_user, name="admin_delete_user"),
    path("admin/stats/", views.admin_user_stats, name="admin_user_stats"),
    path("health/", views.health_check, name="health_check"),
]
