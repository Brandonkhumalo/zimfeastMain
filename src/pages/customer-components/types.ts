export interface Restaurant {
  id: string;
  name: string;
  description?: string;
  cuisineType: 'traditional' | 'fast_food' | 'pizza' | 'chinese' | 'indian' | 'breakfast' | 'desserts' | 'other' | 'lunch_pack';
  latitude?: number;
  longitude?: number;
  rating?: number;
  image?: string;
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
