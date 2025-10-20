from django.urls import path
from . import views

urlpatterns = [
    # Payment initiation
    path("create/payment/", views.create_payment, name='create_payment'),

    # PayNow automatic callback
    path('result/', views.paynow_result, name='paynow_result'),

    # (Optional) legacy PayNow callback
    path('callback/', views.paynow_callback, name='paynow_callback'),

    # Voucher deposit / top-up
    path('deposit/', views.deposit_voucher, name='deposit_voucher'),

    # Manual transaction status check
    path('status/<str:reference>/', views.paynow_status, name='paynow_status'),

    path("feast/voucher/balance/", views.feast_voucher_balance, name="feast-voucher-balance"),
]
