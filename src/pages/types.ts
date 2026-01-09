
export interface FoodItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
}

export interface Restaurant {
  id: string;
  name: string;
  rating: number;
  deliveryTime: string;
  deliveryFee: number;
  image: string;
  categories: string[];
  menu: FoodItem[];
  isFeatured?: boolean;
}

export interface CartItem extends FoodItem {
  quantity: number;
  restaurantId: string;
  restaurantName: string;
}

export type View = 'home' | 'restaurant' | 'checkout' | 'orders';
