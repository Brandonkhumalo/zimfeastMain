"""
Add operating hours fields (opening_time, closing_time, is_open_override)
to the Restaurant model.

Run:
    cd backend/restaurant-service
    python manage.py migrate
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        # If this is the first migration for this app, use initial=True.
        # Otherwise, list the previous migration here.
    ]

    operations = [
        migrations.AddField(
            model_name="restaurant",
            name="opening_time",
            field=models.TimeField(
                blank=True, null=True, help_text="Daily opening time"
            ),
        ),
        migrations.AddField(
            model_name="restaurant",
            name="closing_time",
            field=models.TimeField(
                blank=True, null=True, help_text="Daily closing time"
            ),
        ),
        migrations.AddField(
            model_name="restaurant",
            name="is_open_override",
            field=models.BooleanField(
                blank=True,
                null=True,
                help_text="Manual override: True=force open, False=force closed, None=use schedule",
            ),
        ),
    ]
