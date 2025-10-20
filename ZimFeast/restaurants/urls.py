from django.urls import path
from . import views

urlpatterns = [
    # Restaurant creation & update
    path('create/', views.create_restaurant, name='create_restaurant'),
    path('<str:restaurant_id>/', views.update_restaurant, name='update_restaurant'),

    # External APIs
    path('<str:restaurant_id>/external-apis/', views.add_external_api, name='add_external_api'),

    # Menu items
    path('add/menu-items/', views.add_menu_item, name='add_menu_item'),
    path("menu/<str:menu_id>/delete/", views.delete_menu_item, name="delete_menu_item"),

    # Restaurant detail & nearby
    path('<str:restaurant_id>/detail/', views.get_restaurant_detail, name='restaurant_detail'),
    path('nearby/', views.list_nearby_restaurants, name='nearby_restaurants'),

    # Categories and menu data
    path('<str:restaurant_id>/categories/', views.get_categories, name='get_categories'),
    path('<str:restaurant_id>/menu/', views.get_menu_data, name='get_menu_data'),
    path('menu/', views.get_menu_items, name='restaurant_menu'),

    # Order status updates
    path('orders/<str:order_id>/preparing/', views.mark_order_preparing, name='mark_order_preparing'),
    path('orders/<str:order_id>/completed/', views.mark_order_completed, name='mark_order_completed'),

    #create cuisine
    path('create/cuisine/', views.create_cuisine, name='create_cuisine'),
    path('get/cuisine/types/', views.list_cuisines, name='list_cuisine'),

    path('create/category/', views.create_category, name='create_cuisine'),
    path('get/category/types/', views.list_categories, name='list_cuisine'),

    path('get/all/', views.list_restaurants)
]
