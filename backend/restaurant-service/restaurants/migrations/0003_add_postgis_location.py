"""
Add PostGIS geography point column to Restaurant for spatial queries.
Also backfills existing rows from lat/lng.

Run:
    cd backend/restaurant-service
    python manage.py migrate
"""

from django.contrib.gis.db import models as gis_models
from django.db import migrations


def backfill_location(apps, schema_editor):
    """Populate the location geography column from existing lat/lng values."""
    from django.contrib.gis.geos import Point
    Restaurant = apps.get_model("restaurants", "Restaurant")
    for r in Restaurant.objects.filter(location__isnull=True).iterator():
        if r.lat is not None and r.lng is not None:
            Restaurant.objects.filter(pk=r.pk).update(
                location=Point(r.lng, r.lat, srid=4326)
            )


class Migration(migrations.Migration):

    dependencies = [
        ("restaurants", "0002_add_ranking_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="restaurant",
            name="location",
            field=gis_models.PointField(
                geography=True, srid=4326, null=True, blank=True,
            ),
        ),
        migrations.RunPython(backfill_location, migrations.RunPython.noop),
    ]
