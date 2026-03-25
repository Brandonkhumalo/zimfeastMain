"""
Add ranking fields (avg_prep_time, order_count) to the Restaurant model
for composite search ranking.

Run:
    cd backend/restaurant-service
    python manage.py migrate
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("restaurants", "0001_add_operating_hours"),
    ]

    operations = [
        migrations.AddField(
            model_name="restaurant",
            name="avg_prep_time",
            field=models.FloatField(
                default=0,
                help_text="Rolling average prep time in minutes",
            ),
        ),
        migrations.AddField(
            model_name="restaurant",
            name="order_count",
            field=models.IntegerField(
                default=0,
                help_text="Total completed orders",
            ),
        ),
    ]
