"""
AI Service for Chef Zim food recommendations
Uses OpenAI API to provide personalized food suggestions based on user context.
"""
import os
import json
import logging
import requests
from typing import List, Dict, Any, Optional
from django.db.models import Q
from .models import Restaurant, MenuItem, RestaurantExternalAPI

logger = logging.getLogger(__name__)

# the newest OpenAI model is "gpt-5" which was released August 7, 2025.
# do not change this unless explicitly requested by the user
OPENAI_MODEL = "gpt-5"

def get_openai_client():
    """Get OpenAI client with API key from Django settings or environment."""
    try:
        from openai import OpenAI
        from django.conf import settings
        api_key = getattr(settings, 'OPENAI_API_KEY', None) or os.environ.get("OPENAI_API_KEY")
        if not api_key:
            logger.warning("OPENAI_API_KEY not found in settings or environment")
            return None
        return OpenAI(api_key=api_key)
    except ImportError:
        logger.error("OpenAI package not installed")
        return None


def fetch_external_menu_items(restaurant: Restaurant) -> List[Dict[str, Any]]:
    """Fetch menu items from restaurant's external API if configured."""
    external_items = []
    try:
        menu_api = restaurant.external_apis.filter(category='menu_api').first()
        if menu_api:
            headers = {}
            if menu_api.api_key:
                headers['Authorization'] = f'Bearer {menu_api.api_key}'
            
            response = requests.get(menu_api.api_url, headers=headers, timeout=5)
            if response.ok:
                data = response.json()
                if isinstance(data, list):
                    for item in data[:50]:
                        external_items.append({
                            'source': 'external_api',
                            'restaurant_id': str(restaurant.id),
                            'restaurant_name': restaurant.name,
                            'name': item.get('name', 'Unknown'),
                            'description': item.get('description', ''),
                            'price': item.get('price', 0),
                            'category': item.get('category', ''),
                        })
    except Exception as e:
        logger.warning(f"Failed to fetch external menu for {restaurant.name}: {e}")
    return external_items


def get_all_menu_items(user_lat: Optional[float] = None, user_lng: Optional[float] = None) -> List[Dict[str, Any]]:
    """Aggregate all menu items from database and external APIs."""
    all_items = []
    
    restaurants = Restaurant.objects.prefetch_related('menu_items', 'cuisines', 'external_apis').all()
    
    for restaurant in restaurants:
        cuisines = [c.name for c in restaurant.cuisines.all()]
        
        for item in restaurant.menu_items.filter(available=True):
            categories = [c.name for c in item.category.all()]
            all_items.append({
                'source': 'database',
                'restaurant_id': str(restaurant.id),
                'restaurant_name': restaurant.name,
                'restaurant_cuisines': cuisines,
                'item_id': str(item.id),
                'name': item.name,
                'description': item.description,
                'price': float(item.price),
                'categories': categories,
                'prep_time': item.prep_time,
                'image_url': item.item_image.url if item.item_image else None,
            })
        
        external_items = fetch_external_menu_items(restaurant)
        all_items.extend(external_items)
    
    return all_items


def generate_ai_recommendations(
    mood: str,
    craving: str,
    day_type: str,
    weather: str,
    party_size: str,
    menu_items: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """Use OpenAI to generate personalized food recommendations."""
    
    client = get_openai_client()
    if not client:
        return {
            'success': False,
            'error': 'AI service not configured. Please add your OpenAI API key.',
            'recommendations': []
        }
    
    menu_summary = []
    for item in menu_items[:100]:
        menu_summary.append({
            'restaurant': item.get('restaurant_name'),
            'dish': item.get('name'),
            'description': item.get('description', '')[:100],
            'price': item.get('price'),
            'categories': item.get('categories', []),
            'cuisines': item.get('restaurant_cuisines', []),
        })
    
    system_prompt = """You are Chef Zim, a friendly AI food concierge for ZimFeast, a food delivery platform in Zimbabwe. 
Your job is to recommend dishes based on the customer's mood, cravings, weather, and party size.

You have access to the restaurant menus and should recommend specific dishes that match the customer's preferences.
Always be warm, helpful, and make appetizing suggestions.

IMPORTANT: You must respond with valid JSON only. No markdown, no extra text.
The JSON must have this exact structure:
{
    "greeting": "A personalized greeting based on their mood and context",
    "recommendations": [
        {
            "dish_name": "Name of the dish",
            "restaurant_name": "Restaurant name",
            "reason": "Why this dish is perfect for them",
            "match_score": 95
        }
    ],
    "closing": "A friendly closing message"
}

Recommend 3-5 dishes that best match the customer's needs. Consider:
- Mood: comfort food for sad days, light food for energetic moods
- Weather: warm soups for cold/rainy days, refreshing items for hot days
- Party size: shareable dishes for groups, individual portions for solo diners
- Day type: quick meals for workdays, leisurely options for weekends"""

    user_message = f"""Customer Context:
- Mood: {mood}
- Craving: {craving}
- Day type: {day_type}
- Weather: {weather}
- Party size: {party_size}

Available Menu Items:
{json.dumps(menu_summary, indent=2)}

Based on this context, recommend the best dishes for this customer. Return your response as JSON."""

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            response_format={"type": "json_object"},
            max_completion_tokens=2048
        )
        
        result = json.loads(response.choices[0].message.content)
        
        enhanced_recommendations = []
        for rec in result.get('recommendations', []):
            for item in menu_items:
                if (item.get('name', '').lower() == rec.get('dish_name', '').lower() and 
                    item.get('restaurant_name', '').lower() == rec.get('restaurant_name', '').lower()):
                    enhanced_recommendations.append({
                        **rec,
                        'item_id': item.get('item_id'),
                        'restaurant_id': item.get('restaurant_id'),
                        'price': item.get('price'),
                        'image_url': item.get('image_url'),
                        'source': item.get('source'),
                    })
                    break
            else:
                enhanced_recommendations.append(rec)
        
        return {
            'success': True,
            'greeting': result.get('greeting', ''),
            'recommendations': enhanced_recommendations,
            'closing': result.get('closing', ''),
        }
        
    except Exception as e:
        logger.error(f"AI recommendation error: {e}")
        return {
            'success': False,
            'error': str(e),
            'recommendations': []
        }


def search_restaurants_and_items(query: str, user_lat: Optional[float] = None, user_lng: Optional[float] = None) -> Dict[str, Any]:
    """Search across restaurants, cuisines, and menu items."""
    query_lower = query.lower().strip()
    
    if not query_lower:
        return {'restaurants': [], 'dishes': [], 'cuisines': []}
    
    restaurants = Restaurant.objects.filter(
        Q(name__icontains=query_lower) |
        Q(description__icontains=query_lower) |
        Q(cuisines__name__icontains=query_lower)
    ).distinct().prefetch_related('cuisines', 'menu_items')[:20]
    
    cuisines = list(
        Restaurant.objects.filter(cuisines__name__icontains=query_lower)
        .values_list('cuisines__name', flat=True)
        .distinct()[:10]
    )
    
    dishes = MenuItem.objects.filter(
        Q(name__icontains=query_lower) |
        Q(description__icontains=query_lower) |
        Q(category__name__icontains=query_lower),
        available=True
    ).select_related('restaurant').prefetch_related('category')[:30]
    
    restaurant_results = []
    for r in restaurants:
        restaurant_results.append({
            'id': str(r.id),
            'name': r.name,
            'description': r.description[:100] if r.description else '',
            'cuisines': [c.name for c in r.cuisines.all()],
            'profile_image': r.profile_image.url if r.profile_image else None,
            'est_delivery_time': r.est_delivery_time,
            'minimum_order_price': float(r.minimum_order_price),
        })
    
    dish_results = []
    for d in dishes:
        dish_results.append({
            'id': str(d.id),
            'name': d.name,
            'description': d.description[:100] if d.description else '',
            'price': float(d.price),
            'categories': [c.name for c in d.category.all()],
            'restaurant_id': str(d.restaurant.id),
            'restaurant_name': d.restaurant.name,
            'image_url': d.item_image.url if d.item_image else None,
        })
    
    return {
        'restaurants': restaurant_results,
        'dishes': dish_results,
        'cuisines': cuisines,
    }
