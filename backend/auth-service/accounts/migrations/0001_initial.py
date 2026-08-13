import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.CreateModel(
            name='CustomUser',
            fields=[
                ('password', models.CharField(max_length=128, verbose_name='password')),
                ('last_login', models.DateTimeField(blank=True, null=True, verbose_name='last login')),
                ('is_superuser', models.BooleanField(
                    default=False,
                    help_text='Designates that this user has all permissions without explicitly assigning them.',
                    verbose_name='superuser status',
                )),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('email', models.EmailField(max_length=254, unique=True)),
                ('first_name', models.CharField(blank=True, max_length=255)),
                ('last_name', models.CharField(blank=True, max_length=255)),
                ('phone_number', models.CharField(blank=True, max_length=50)),
                ('role', models.CharField(
                    choices=[
                        ('customer', 'Customer'),
                        ('restaurant', 'Restaurant'),
                        ('driver', 'Driver'),
                        ('admin', 'Admin'),
                        ('corporate_admin', 'Corporate Admin'),
                    ],
                    default='customer',
                    max_length=30,
                )),
                ('is_active', models.BooleanField(default=True)),
                ('is_staff', models.BooleanField(default=False)),
                ('groups', models.ManyToManyField(
                    blank=True,
                    help_text='The groups this user belongs to. A user will get all permissions granted to each of their groups.',
                    related_name='user_set',
                    related_query_name='user',
                    to='auth.group',
                    verbose_name='groups',
                )),
                ('user_permissions', models.ManyToManyField(
                    blank=True,
                    help_text='Specific permissions for this user.',
                    related_name='user_set',
                    related_query_name='user',
                    to='auth.permission',
                    verbose_name='user permissions',
                )),
            ],
            options={
                'abstract': False,
            },
        ),
        migrations.CreateModel(
            name='BlacklistedToken',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('token', models.CharField(max_length=255, unique=True)),
                ('blacklisted_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.CreateModel(
            name='Address',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('label', models.CharField(default='home', max_length=100)),
                ('address_text', models.CharField(max_length=255)),
                ('lat', models.FloatField()),
                ('lng', models.FloatField()),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='addresses',
                    to='accounts.customuser',
                )),
            ],
        ),
        migrations.CreateModel(
            name='CorporateAccount',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('company_name', models.CharField(max_length=255)),
                ('billing_email', models.EmailField(max_length=254)),
                ('billing_address', models.TextField(blank=True)),
                ('monthly_spending_limit', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('current_month_spending', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('invoice_day', models.IntegerField(default=1)),
                ('is_active', models.BooleanField(default=True)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('admin_user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='corporate_admin',
                    to='accounts.customuser',
                )),
            ],
        ),
        migrations.CreateModel(
            name='CorporateEmployee',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('personal_spending_limit', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('current_month_spending', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('requires_approval', models.BooleanField(default=False)),
                ('is_active', models.BooleanField(default=True)),
                ('created', models.DateTimeField(auto_now_add=True)),
                ('corporate_account', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='employees',
                    to='accounts.corporateaccount',
                )),
                ('user', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='corporate_membership',
                    to='accounts.customuser',
                )),
            ],
            options={
                'unique_together': {('corporate_account', 'user')},
            },
        ),
    ]
