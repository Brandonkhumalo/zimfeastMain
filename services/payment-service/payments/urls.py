from django.urls import path
from . import views

urlpatterns = [
    path("create/payment/", views.create_payment, name='create_payment'),
    path('result/', views.paynow_result, name='paynow_result'),
    path('callback/', views.paynow_callback, name='paynow_callback'),
    path('deposit/', views.deposit_voucher, name='deposit_voucher'),
    path('status/<str:reference>/', views.paynow_status, name='paynow_status'),
    path("feast/voucher/balance/", views.feast_voucher_balance, name="feast_voucher_balance"),
    path("health/", views.health_check, name="health_check"),
]
