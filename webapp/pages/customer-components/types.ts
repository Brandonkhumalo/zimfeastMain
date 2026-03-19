export interface Cuisine {
  id: number;
  name: string;
}

export interface MenuItem {
  id: string;
  restaurant: string;
  name: string;
  price: string;
  description: string;
  category: string[];
  prep_time: number;
  available: boolean;
  item_image: string | null;
  created: string;
}

export interface ExternalAPI {
  id: number;
  category: string;
  api_url: string;
}

export interface Restaurant {
  id: string;
  name: string;
  description?: string;
  phone_number: string;
  full_address: string;
  lat: number;
  lng: number;
  minimum_order_price: string;
  est_delivery_time: string;
  cuisines: Cuisine[];
  external_apis?: ExternalAPI[];
  menu_items?: MenuItem[];
  rating?: number;
  imageUrl?: string;
  coordinates?: { lat: number; lng: number };
  estimatedDeliveryTime?: number;
  distance_km?: number | null;
  created: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  restaurantId?: string;
  restaurantLat?: number;
  restaurantLng?: number;
}
