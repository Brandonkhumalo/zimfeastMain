"""Retained migration slot; PostGIS is no longer required."""

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("restaurants", "0002_add_ranking_fields"),
    ]

    operations = []
