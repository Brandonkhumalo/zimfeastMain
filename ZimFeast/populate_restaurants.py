import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "ZimFeast.settings")
django.setup()

from restaurants.models import Restaurant, MenuItem, CuisineType, CategoryType, RestaurantExternalAPI
from accounts.models import CustomUser
from django.core.files import File
from django.core.files.uploadedfile import SimpleUploadedFile
import urllib.request
from decimal import Decimal

def create_restaurants():
    print("Creating cuisine and category types...")
    
    cuisines_data = ["African", "Asian", "American", "Italian", "Mexican", "Fast Food", "Healthy", "Desserts", "Vegetarian", "Seafood"]
    categories_data = ["Burgers", "Pizza", "Chicken", "Salads", "Sides", "Desserts", "Drinks", "Breakfast", "Sandwiches", "Pasta"]
    
    cuisines = {}
    for cuisine_name in cuisines_data:
        cuisine, _ = CuisineType.objects.get_or_create(name=cuisine_name)
        cuisines[cuisine_name] = cuisine
    
    categories = {}
    for category_name in categories_data:
        category, _ = CategoryType.objects.get_or_create(name=category_name)
        categories[category_name] = category
    
    print("Deleting existing restaurants and demo owners...")
    Restaurant.objects.all().delete()
    CustomUser.objects.filter(email__startswith="restaurant").delete()
    
    restaurants_data = [
        {
            "name": "KFC Zimbabwe",
            "description": "World-famous fried chicken with signature taste",
            "cuisines": ["Fast Food", "American"],
            "lat": -17.8252,
            "lng": 31.0335,
            "address": "Sam Levy's Village, Borrowdale, Harare",
            "min_order": 5.00,
            "est_time": "20-30 mins",
            "menu": [
                {"name": "Original Recipe Bucket", "price": 25.99, "category": "Chicken", "desc": "12 pieces of our signature fried chicken"},
                {"name": "Zinger Burger Meal", "price": 8.99, "category": "Burgers", "desc": "Spicy chicken fillet burger with fries and drink"},
                {"name": "Coleslaw", "price": 2.50, "category": "Sides", "desc": "Fresh and creamy coleslaw"}
            ]
        },
        {
            "name": "Nando's Harare",
            "description": "Peri-Peri chicken grilled to perfection",
            "cuisines": ["African", "Fast Food"],
            "lat": -17.8292,
            "lng": 31.0522,
            "address": "Arundel Village, Harare",
            "min_order": 7.00,
            "est_time": "25-35 mins",
            "menu": [
                {"name": "Full Chicken Peri-Peri", "price": 18.50, "category": "Chicken", "desc": "Whole chicken with your choice of peri-peri spice"},
                {"name": "Chicken Wrap", "price": 7.99, "category": "Sandwiches", "desc": "Grilled chicken strips wrapped with fresh veggies"},
                {"name": "Portuguese Roll", "price": 1.50, "category": "Sides", "desc": "Soft Portuguese-style bread roll"}
            ]
        },
        {
            "name": "Pizza Inn",
            "description": "Premium pizzas with fresh toppings",
            "cuisines": ["Italian", "Fast Food"],
            "lat": -17.8310,
            "lng": 31.0450,
            "address": "Newlands Shopping Center, Harare",
            "min_order": 10.00,
            "est_time": "30-40 mins",
            "menu": [
                {"name": "Meat Lovers Pizza", "price": 14.99, "category": "Pizza", "desc": "Loaded with beef, sausage, bacon and pepperoni"},
                {"name": "Margherita Pizza", "price": 9.99, "category": "Pizza", "desc": "Classic tomato sauce, mozzarella and fresh basil"},
                {"name": "Garlic Bread", "price": 3.50, "category": "Sides", "desc": "Toasted bread with garlic butter"}
            ]
        },
        {
            "name": "Ocean Basket",
            "description": "Fresh seafood and Mediterranean cuisine",
            "cuisines": ["Seafood", "Healthy"],
            "lat": -17.8200,
            "lng": 31.0290,
            "address": "Sam Levy's Village, Borrowdale, Harare",
            "min_order": 12.00,
            "est_time": "35-45 mins",
            "menu": [
                {"name": "Grilled Calamari", "price": 16.99, "category": "Seafood", "desc": "Tender calamari rings grilled with lemon butter"},
                {"name": "Fish and Chips", "price": 12.99, "category": "Seafood", "desc": "Battered fish fillet with golden fries"},
                {"name": "Greek Salad", "price": 6.99, "category": "Salads", "desc": "Fresh salad with feta, olives and cucumbers"}
            ]
        },
        {
            "name": "Chicken Inn",
            "description": "Southern fried chicken and more",
            "cuisines": ["Fast Food", "African"],
            "lat": -17.8350,
            "lng": 31.0380,
            "address": "Avondale Shopping Centre, Harare",
            "min_order": 5.00,
            "est_time": "20-30 mins",
            "menu": [
                {"name": "Chicken Pieces Meal", "price": 7.99, "category": "Chicken", "desc": "4 pieces of crispy fried chicken with chips"},
                {"name": "Chicken Burger", "price": 4.99, "category": "Burgers", "desc": "Fried chicken patty with lettuce and mayo"},
                {"name": "Sadza and Chicken", "price": 8.50, "category": "African", "desc": "Traditional sadza with chicken stew"}
            ]
        },
        {
            "name": "Steers",
            "description": "Flame-grilled burgers and ribs",
            "cuisines": ["Fast Food", "American"],
            "lat": -17.8180,
            "lng": 31.0470,
            "address": "Eastgate Mall, Harare",
            "min_order": 6.00,
            "est_time": "25-30 mins",
            "menu": [
                {"name": "King Steer Burger", "price": 9.99, "category": "Burgers", "desc": "Double beef patty with cheese, bacon and special sauce"},
                {"name": "Chicken Burger Combo", "price": 7.99, "category": "Burgers", "desc": "Grilled chicken burger with chips and drink"},
                {"name": "Chips & Cheese", "price": 3.99, "category": "Sides", "desc": "Crispy fries topped with melted cheese"}
            ]
        },
        {
            "name": "Amanzi Restaurant",
            "description": "Authentic African cuisine and hospitality",
            "cuisines": ["African", "Vegetarian"],
            "lat": -17.8330,
            "lng": 31.0550,
            "address": "Borrowdale Road, Harare",
            "min_order": 8.00,
            "est_time": "30-40 mins",
            "menu": [
                {"name": "Nyama Choma Platter", "price": 19.99, "category": "African", "desc": "Grilled meat selection with sadza and relish"},
                {"name": "Vegetable Curry", "price": 9.99, "category": "Vegetarian", "desc": "Mixed vegetables in aromatic curry sauce"},
                {"name": "Madora (Mopane Worms)", "price": 6.50, "category": "African", "desc": "Traditional protein-rich delicacy"}
            ]
        },
        {
            "name": "Gava's Restaurant",
            "description": "Traditional Zimbabwean dishes",
            "cuisines": ["African"],
            "lat": -17.8400,
            "lng": 31.0320,
            "address": "Robert Mugabe Road, Harare",
            "min_order": 7.00,
            "est_time": "30-35 mins",
            "menu": [
                {"name": "Sadza ne Huku", "price": 8.99, "category": "African", "desc": "Sadza with chicken in peanut butter sauce"},
                {"name": "Oxtail Stew", "price": 15.99, "category": "African", "desc": "Slow-cooked oxtail in rich gravy"},
                {"name": "Chakalaka", "price": 3.50, "category": "Sides", "desc": "Spicy vegetable relish"}
            ]
        },
        {
            "name": "Pariah State",
            "description": "Trendy burgers and craft beers",
            "cuisines": ["American", "Fast Food"],
            "lat": -17.8270,
            "lng": 31.0500,
            "address": "Fife Avenue, Harare",
            "min_order": 10.00,
            "est_time": "25-35 mins",
            "menu": [
                {"name": "Pariah Burger", "price": 11.99, "category": "Burgers", "desc": "Gourmet beef burger with caramelized onions and bacon"},
                {"name": "Loaded Fries", "price": 6.99, "category": "Sides", "desc": "Fries topped with cheese, bacon and sour cream"},
                {"name": "Chicken Wings", "price": 8.99, "category": "Chicken", "desc": "Spicy buffalo wings with ranch dip"}
            ]
        },
        {
            "name": "The Smokehouse",
            "description": "BBQ meats and smoky flavors",
            "cuisines": ["American", "Fast Food"],
            "lat": -17.8150,
            "lng": 31.0410,
            "address": "Borrowdale Village, Harare",
            "min_order": 12.00,
            "est_time": "35-45 mins",
            "menu": [
                {"name": "BBQ Ribs Platter", "price": 22.99, "category": "American", "desc": "Slow-smoked ribs with BBQ sauce and coleslaw"},
                {"name": "Pulled Pork Sandwich", "price": 10.99, "category": "Sandwiches", "desc": "Tender pulled pork on toasted bun"},
                {"name": "Mac and Cheese", "price": 4.99, "category": "Sides", "desc": "Creamy macaroni and cheese"}
            ]
        }
    ]
    
    print("Creating 10 restaurants with menu items...")
    
    for idx, rest_data in enumerate(restaurants_data, 1):
        print(f"\nCreating restaurant {idx}/10: {rest_data['name']}...")
        
        owner = CustomUser.objects.create(
            email=f"restaurant{idx}@zimfeast.com",
            phone_number=f"+26377123456{idx}",
            role="restaurant",
            first_name=rest_data['name'].split()[0],
            is_staff=False
        )
        owner.set_password("demo12345")
        owner.save()
        
        restaurant = Restaurant.objects.create(
            owner=owner,
            name=rest_data['name'],
            description=rest_data['description'],
            full_address=rest_data['address'],
            lat=rest_data['lat'],
            lng=rest_data['lng'],
            minimum_order_price=Decimal(str(rest_data['min_order'])),
            est_delivery_time=rest_data['est_time'],
            phone_number=f"+26377123456{idx}"
        )
        
        for cuisine_name in rest_data['cuisines']:
            restaurant.cuisines.add(cuisines[cuisine_name])
        
        print(f"  Creating external API 'get_menu'...")
        RestaurantExternalAPI.objects.create(
            restaurant=restaurant,
            category="get_menu",
            api_url="https://kfc-chickens.p.rapidapi.com/chickens/2",
            api_key=""
        )
        
        print(f"  Creating {len(rest_data['menu'])} menu items...")
        for menu_item_data in rest_data['menu']:
            menu_item = MenuItem.objects.create(
                restaurant=restaurant,
                name=menu_item_data['name'],
                price=Decimal(str(menu_item_data['price'])),
                description=menu_item_data['desc'],
                prep_time=15,
                available=True
            )
            
            if menu_item_data['category'] in categories:
                menu_item.category.add(categories[menu_item_data['category']])
        
        print(f"  ✓ Restaurant '{rest_data['name']}' created successfully!")
    
    print(f"\n✅ Successfully created {len(restaurants_data)} restaurants with menus and external APIs!")
    print("\nSummary:")
    print(f"  - Total Restaurants: {Restaurant.objects.count()}")
    print(f"  - Total Menu Items: {MenuItem.objects.count()}")
    print(f"  - Total External APIs: {RestaurantExternalAPI.objects.count()}")

if __name__ == "__main__":
    create_restaurants()
