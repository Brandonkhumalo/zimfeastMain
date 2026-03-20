from django.urls import path
from . import views

urlpatterns = [
    path("create/payment/", views.create_payment, name='create_payment'),
    path('result/', views.paynow_result, name='paynow_result'),
    path('callback/', views.paynow_callback, name='paynow_callback'),
    path('deposit/', views.deposit_voucher, name='deposit_voucher'),
    path('status/<str:reference>/', views.paynow_status, name='paynow_status'),
    path("feast/voucher/balance/", views.feast_voucher_balance, name="feast_voucher_balance"),

    # Promo code endpoints
    path("promo/validate/", views.validate_promo, name="validate_promo"),
    path("promo/create/", views.admin_create_promo, name="admin_create_promo"),
    path("promo/list/", views.admin_list_promos, name="admin_list_promos"),

    # Referral endpoints
    path("referral/code/", views.get_referral_code, name="get_referral_code"),
    path("referral/credits/", views.get_referral_credits, name="get_referral_credits"),
    path("referral/apply/", views.apply_referral_credit, name="apply_referral_credit"),
    path("referral/track/", views.track_referral, name="track_referral"),

    # Admin finance endpoints
    path("admin/finance-summary/", views.admin_finance_summary, name="admin_finance_summary"),
    path("admin/failed-payments/", views.admin_failed_payments, name="admin_failed_payments"),
    path("admin/settlements/", views.admin_settlements, name="admin_settlements"),
    path("admin/refund/", views.admin_refund, name="admin_refund"),

    path("health/", views.admin_health_check, name="health_check"),
]
