import django.db.models.deletion
import restaurants.models
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='CategoryType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name='CuisineType',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, unique=True)),
            ],
        ),
        migrations.CreateModel(
            name='RestaurantChain',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255, unique=True)),
                ('description', models.TextField(blank=True)),
                ('logo', models.ImageField(blank=True, null=True, upload_to='chain_logos/')),
                ('website', models.URLField(blank=True)),
                ('menu_api_url', models.URLField(blank=True, help_text='Central API URL to sync menus across all branches')),
                ('menu_api_key', restaurants.models.EncryptedCharField(blank=True, max_length=500)),
                ('order_webhook_url', models.URLField(blank=True, help_text='Webhook URL to notify chain when orders arrive')),
                ('order_webhook_secret', restaurants.models.EncryptedCharField(blank=True, max_length=500)),
                ('accepts_direct_payment', models.BooleanField(default=False, help_text='If true, customers pay the restaurant directly')),
                ('paynow_integration_id', models.CharField(blank=True, max_length=50)),
                ('paynow_integration_key', restaurants.models.EncryptedCharField(blank=True, max_length=500)),
                ('platform_commission_pct', models.DecimalField(decimal_places=2, default=15.0, help_text='Platform commission percentage', max_digits=5)),
                ('created', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='Restaurant',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('owner_id', models.UUIDField(db_index=True)),
                ('name', models.CharField(max_length=255)),
                ('phone_number', models.CharField(blank=True, max_length=30)),
                ('description', models.TextField(blank=True)),
                ('profile_image', models.ImageField(blank=True, null=True, upload_to='restaurant_profiles/')),
                ('full_address', models.CharField(max_length=500)),
                ('lat', models.FloatField()),
                ('lng', models.FloatField()),
                ('minimum_order_price', models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ('est_delivery_time', models.CharField(blank=True, max_length=50)),
                ('average_rating', models.FloatField(default=0)),
                ('total_reviews', models.IntegerField(default=0)),
                ('opening_time', models.TimeField(blank=True, help_text='Daily opening time', null=True)),
                ('closing_time', models.TimeField(blank=True, help_text='Daily closing time', null=True)),
                ('is_open_override', models.BooleanField(blank=True, help_text='Manual override: True=force open, False=force closed, None=use schedule', null=True)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('chain', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='restaurants', to='restaurants.restaurantchain')),
                ('cuisines', models.ManyToManyField(blank=True, to='restaurants.cuisinetype')),
            ],
        ),
        migrations.CreateModel(
            name='Banner',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('title', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('image', models.ImageField(blank=True, null=True, upload_to='banners/')),
                ('link_url', models.CharField(blank=True, max_length=500)),
                ('campaign_type', models.CharField(choices=[('info', 'Information'), ('free_delivery', 'Free Delivery'), ('discount', 'Discount'), ('new_restaurant', 'New Restaurant')], default='info', max_length=30)),
                ('target_audience', models.CharField(choices=[('all', 'All Users'), ('new_users', 'New Users'), ('returning', 'Returning Users')], default='all', max_length=30)),
                ('free_delivery_threshold', models.DecimalField(blank=True, decimal_places=2, max_digits=8, null=True)),
                ('start_date', models.DateTimeField()),
                ('end_date', models.DateTimeField()),
                ('is_active', models.BooleanField(default=True)),
                ('priority', models.IntegerField(default=0)),
                ('created', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'ordering': ['-priority', '-created'],
            },
        ),
        migrations.CreateModel(
            name='Branch',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('address', models.CharField(max_length=500)),
                ('lat', models.FloatField()),
                ('lng', models.FloatField()),
                ('phone_number', models.CharField(blank=True, max_length=30)),
                ('is_active', models.BooleanField(default=True)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='branches', to='restaurants.restaurant')),
            ],
            options={
                'indexes': [models.Index(fields=['restaurant', 'is_active'], name='restaurant_restaur_restaur_8fe56f_idx')],
            },
        ),
        migrations.CreateModel(
            name='MenuItem',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('name', models.CharField(max_length=255)),
                ('price', models.DecimalField(decimal_places=2, max_digits=8)),
                ('description', models.TextField(blank=True)),
                ('prep_time', models.IntegerField(blank=True, help_text='Preparation time in minutes', null=True)),
                ('available', models.BooleanField(default=True)),
                ('item_image', models.ImageField(upload_to='menu_items/')),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('category', models.ManyToManyField(blank=True, to='restaurants.categorytype')),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='menu_items', to='restaurants.restaurant')),
            ],
            options={
                'indexes': [models.Index(fields=['restaurant', 'name'], name='restaurant_menuite_restaur_68dfb8_idx')],
            },
        ),
        migrations.CreateModel(
            name='RestaurantDashboard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('today_orders', models.IntegerField(default=0)),
                ('today_revenue', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('today_average_rating', models.FloatField(default=3.0)),
                ('preparing', models.JSONField(default=list, help_text="DEPRECATED: Use DashboardOrder with status='preparing' instead")),
                ('pending', models.JSONField(default=list, help_text="DEPRECATED: Use DashboardOrder with status='pending' instead")),
                ('completed', models.JSONField(default=list, help_text="DEPRECATED: Use DashboardOrder with status='completed' instead")),
                ('last_updated', models.DateTimeField(auto_now=True)),
                ('restaurant', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='dashboard', to='restaurants.restaurant')),
            ],
        ),
        migrations.CreateModel(
            name='RestaurantExternalAPI',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('category', models.CharField(max_length=100)),
                ('api_url', models.URLField()),
                ('api_key', models.CharField(blank=True, max_length=255, null=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='external_apis', to='restaurants.restaurant')),
            ],
            options={
                'unique_together': {('restaurant', 'category')},
            },
        ),
        migrations.CreateModel(
            name='RestaurantFinanceSummary',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('total_revenue', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_platform_fees', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('total_earnings', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('unsettled_platform_fees', models.DecimalField(decimal_places=2, default=0, help_text='Accumulated fees restaurant owes platform', max_digits=12)),
                ('unsettled_delivery_fees', models.DecimalField(decimal_places=2, default=0, help_text='Delivery fees restaurant owes platform from direct payments', max_digits=12)),
                ('total_debt', models.DecimalField(decimal_places=2, default=0, help_text='Total amount restaurant owes platform (fees + delivery)', max_digits=12)),
                ('total_orders', models.IntegerField(default=0)),
                ('last_updated', models.DateTimeField(auto_now=True)),
                ('restaurant', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='finance_summary', to='restaurants.restaurant')),
            ],
        ),
        migrations.CreateModel(
            name='RestaurantReview',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('user_id', models.UUIDField(db_index=True)),
                ('order_id', models.UUIDField(db_index=True, unique=True)),
                ('rating', models.IntegerField()),
                ('comment', models.TextField(blank=True)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='reviews', to='restaurants.restaurant')),
            ],
            options={
                'indexes': [models.Index(fields=['restaurant', '-created'], name='restaurant_restaur_restaur_c4f620_idx')],
            },
        ),
        migrations.CreateModel(
            name='RestaurantEarning',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('order_id', models.UUIDField(db_index=True)),
                ('order_total', models.DecimalField(decimal_places=2, max_digits=10)),
                ('delivery_fee', models.DecimalField(decimal_places=2, default=0, max_digits=8)),
                ('platform_commission_pct', models.DecimalField(decimal_places=2, default=15.0, max_digits=5)),
                ('platform_fee', models.DecimalField(decimal_places=2, max_digits=10)),
                ('restaurant_earning', models.DecimalField(decimal_places=2, max_digits=10)),
                ('paid_direct', models.BooleanField(default=False, help_text='True if customer paid restaurant directly')),
                ('settled', models.BooleanField(default=False, help_text='True if platform has settled with restaurant')),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='earnings', to='restaurants.restaurant')),
            ],
            options={
                'indexes': [models.Index(fields=['restaurant', 'settled'], name='restaurant_restaur_restaur_f1df45_idx'), models.Index(fields=['-created'], name='restaurant_restaur_created_7fd0f1_idx')],
            },
        ),
        migrations.CreateModel(
            name='RestaurantDebt',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('order_id', models.UUIDField(db_index=True)),
                ('platform_fee', models.DecimalField(decimal_places=2, help_text='Commission we charge', max_digits=10)),
                ('delivery_fee', models.DecimalField(decimal_places=2, help_text='Delivery fee owed to us', max_digits=10)),
                ('total_owed', models.DecimalField(decimal_places=2, help_text='platform_fee + delivery_fee', max_digits=10)),
                ('settled', models.BooleanField(default=False)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('restaurant', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='debts', to='restaurants.restaurant')),
            ],
            options={
                'indexes': [models.Index(fields=['restaurant', 'settled'], name='restaurant_restaur_restaur_cae095_idx'), models.Index(fields=['-created'], name='restaurant_restaur_created_95cb2d_idx')],
            },
        ),
        migrations.CreateModel(
            name='DashboardOrder',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('order_id', models.UUIDField(db_index=True)),
                ('status', models.CharField(choices=[('pending', 'Pending'), ('preparing', 'Preparing'), ('completed', 'Completed')], max_length=20)),
                ('order_data', models.JSONField(default=dict)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('updated', models.DateTimeField(auto_now=True)),
                ('dashboard', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='orders', to='restaurants.restaurantdashboard')),
            ],
            options={
                'indexes': [models.Index(fields=['dashboard', 'status'], name='restaurant_dashboa_dashboa_c3cad6_idx'), models.Index(fields=['-created'], name='restaurant_dashboa_created_6fe60a_idx')],
            },
        ),
    ]
