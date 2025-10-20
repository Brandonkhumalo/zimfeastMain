from rest_framework.pagination import CursorPagination

class NearbyRestaurantCursorPagination(CursorPagination):
    page_size = 10
    ordering = 'id'  # ordering must be unique; 'id' is usually fine