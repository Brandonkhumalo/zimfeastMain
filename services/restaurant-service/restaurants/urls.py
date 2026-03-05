from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.create_restaurant, name='create_restaurant'),
    path('my-restaurant/', views.get_my_restaurant, name='get_my_restaurant'),
    path('nearby/', views.list_nearby_restaurants, name='nearby_restaurants'),
    path('get/all/', views.list_restaurants),
    path('search/', views.list_restaurants, name='search'),  # TODO: implement AI search
    path('add/menu-items/', views.add_menu_item, name='add_menu_item'),
    path("menu/<str:menu_id>/delete/", views.delete_menu_item, name="delete_menu_item"),
    path('menu/', views.get_menu_items, name='restaurant_menu'),
    path('create/cuisine/', views.create_cuisine, name='create_cuisine'),
    path('get/cuisine/types/', views.list_cuisines, name='list_cuisines'),
    path('create/category/', views.create_category, name='create_category'),
    path('get/category/types/', views.list_categories, name='list_categories'),

    # Dynamic restaurant ID patterns
    path('<str:restaurant_id>/', views.update_restaurant, name='update_restaurant'),
    path('<str:restaurant_id>/detail/', views.get_restaurant_detail, name='restaurant_detail'),
    path('<str:restaurant_id>/external-apis/', views.add_external_api, name='add_external_api'),
    path('<str:restaurant_id>/categories/', views.get_categories, name='get_categories'),
    path('<str:restaurant_id>/menu/', views.get_menu_data, name='get_menu_data'),
    path('<str:restaurant_id>/menu-data/', views.get_menu_data, name='get_menu_data_alias'),

    # Order status updates (restaurant-side)
    path('orders/<str:order_id>/preparing/', views.mark_order_preparing, name='mark_order_preparing'),
    path('orders/<str:order_id>/ready/', views.mark_order_ready, name='mark_order_ready'),
    path('orders/<str:order_id>/collected/', views.mark_order_collected, name='mark_order_collected'),

    # Internal
    path('internal/restaurant/<str:restaurant_id>/', views.internal_get_restaurant, name='internal_get_restaurant'),
]
