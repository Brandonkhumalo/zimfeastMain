"""
Initial migration for payment-service models.
Includes all original models (FeastVoucher, Payment) plus
new promo/referral models (PromoCode, ReferralCode, ReferralCredit,
PromoUsage, ReferralTracking).
"""
import django.db.models.deletion
from decimal import Decimal
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        # FeastVoucher
        migrations.CreateModel(
            name='FeastVoucher',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.UUIDField(db_index=True)),
                ('balance', models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=12)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
        ),
        # Payment
        migrations.CreateModel(
            name='Payment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.UUIDField(db_index=True)),
                ('order_id', models.UUIDField(blank=True, db_index=True, null=True)),
                ('restaurant_id', models.UUIDField(blank=True, db_index=True, null=True)),
                ('reference', models.CharField(max_length=100, unique=True)),
                ('amount', models.DecimalField(decimal_places=2, help_text='Total order amount', max_digits=12)),
                ('paynow_amount', models.DecimalField(decimal_places=2, default=0, help_text='Amount paid via PayNow', max_digits=12)),
                ('voucher_amount', models.DecimalField(decimal_places=2, default=0, help_text='Amount paid from voucher', max_digits=12)),
                ('method', models.CharField(choices=[('paynow', 'PayNow'), ('voucher', 'FeastVoucher'), ('voucher_paynow', 'Voucher + PayNow'), ('direct', 'Direct to Restaurant')], max_length=20)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('paid', 'Paid'), ('failed', 'Failed')], default='pending', max_length=20)),
                ('paid_direct', models.BooleanField(default=False, help_text="True if paid directly to restaurant's Paynow")),
                ('platform_fee', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('restaurant_amount', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('processed_at', models.DateTimeField(blank=True, help_text='When the payment callback was successfully processed', null=True)),
            ],
        ),
        # PromoCode
        migrations.CreateModel(
            name='PromoCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('code', models.CharField(db_index=True, max_length=50, unique=True)),
                ('discount_type', models.CharField(choices=[('percentage', 'Percentage'), ('fixed', 'Fixed Amount')], max_length=20)),
                ('discount_value', models.DecimalField(decimal_places=2, max_digits=8)),
                ('min_order_amount', models.DecimalField(decimal_places=2, default=Decimal('0.00'), help_text='Minimum order amount required to use this promo code', max_digits=8)),
                ('max_uses', models.IntegerField(default=0, help_text='0 = unlimited')),
                ('times_used', models.IntegerField(default=0)),
                ('expires_at', models.DateTimeField(blank=True, null=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        # ReferralCode
        migrations.CreateModel(
            name='ReferralCode',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.UUIDField(db_index=True, unique=True)),
                ('code', models.CharField(db_index=True, max_length=20, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        # ReferralCredit
        migrations.CreateModel(
            name='ReferralCredit',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('referrer_id', models.UUIDField(db_index=True)),
                ('referred_id', models.UUIDField(db_index=True)),
                ('order_id', models.UUIDField(db_index=True)),
                ('discount_pct', models.DecimalField(decimal_places=2, default=Decimal('15.00'), max_digits=5)),
                ('is_used', models.BooleanField(default=False)),
                ('used_on_order_id', models.UUIDField(blank=True, null=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        # PromoUsage
        migrations.CreateModel(
            name='PromoUsage',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.UUIDField(db_index=True)),
                ('order_id', models.UUIDField()),
                ('discount_applied', models.DecimalField(decimal_places=2, max_digits=8)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('promo', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='usages', to='payments.promocode')),
            ],
            options={
                'unique_together': {('user_id', 'promo')},
            },
        ),
        # ReferralTracking
        migrations.CreateModel(
            name='ReferralTracking',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('user_id', models.UUIDField(db_index=True, unique=True)),
                ('referrer_id', models.UUIDField(db_index=True)),
                ('referral_code', models.CharField(max_length=20)),
                ('is_qualified', models.BooleanField(default=False, help_text='True once the referred user completes a $20+ order')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
    ]
