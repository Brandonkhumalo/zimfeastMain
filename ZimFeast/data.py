import os
import django
import json
from uuid import UUID

# ------------------------------------------------------------------
# DJANGO SETUP
# ------------------------------------------------------------------
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ZimFeast.settings")
django.setup()

# ------------------------------------------------------------------
# IMPORT MODELS & SERIALIZER
# ------------------------------------------------------------------
from restaurants.models import Restaurant, MenuItem
from restaurants.serializers import MenuItemSerializer
from django.shortcuts import get_object_or_404

# ------------------------------------------------------------------
# CONFIG
# ------------------------------------------------------------------
RESTAURANT_ID = UUID("35fbde085be9420f95018e511d06dc0f")

# Optional category filter (set to None if not needed)
CATEGORY_FILTER = None  # e.g. "Pizza"

# ------------------------------------------------------------------
# FETCH DATA
# ------------------------------------------------------------------
restaurant = get_object_or_404(Restaurant, id=RESTAURANT_ID)

items_qs = MenuItem.objects.filter(restaurant=restaurant)

if CATEGORY_FILTER:
    items_qs = items_qs.filter(category__name__iexact=CATEGORY_FILTER)

serializer = MenuItemSerializer(items_qs, many=True)

# ------------------------------------------------------------------
# OUTPUT
# ------------------------------------------------------------------
print(json.dumps(serializer.data, indent=2, default=str))
