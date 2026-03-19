import { Restaurant } from './types';

export const CATEGORIES = [
  { name: 'Burger', icon: 'https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&q=80&w=150' },
  { name: 'Pizza', icon: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=150' },
  { name: 'Sushi', icon: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=150' },
  { name: 'Tacos', icon: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&q=80&w=150' },
  { name: 'Salad', icon: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=150' },
  { name: 'Chicken', icon: 'https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445?auto=format&fit=crop&q=80&w=150' },
  { name: 'Pasta', icon: 'https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&q=80&w=150' },
  { name: 'Dessert', icon: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=150' },
  { name: 'Coffee', icon: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=150' },
  { name: 'Indian', icon: 'https://images.unsplash.com/photo-1585937421612-71100e957b7d?auto=format&fit=crop&q=80&w=150' },
];

export const RESTAURANTS: Restaurant[] = [
  {
    id: '1',
    name: 'Neon Umami Sushi',
    rating: 4.8,
    deliveryTime: '20-30 min',
    deliveryFee: 2.99,
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=800',
    categories: ['Sushi', 'Japanese', 'Asian'],
    isFeatured: true,
    menu: [
      { id: 'm1', name: 'Electric Eel Roll', description: 'Torched eel with spicy mayo and neon caviar.', price: 18.50, image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&q=80&w=400', category: 'Sushi' },
      { id: 'm2', name: 'Dragon Breath Sashimi', description: 'Fresh salmon with habanero-infused soy.', price: 22.00, image: 'https://images.unsplash.com/photo-1534482421-0d45aa4f9d32?auto=format&fit=crop&q=80&w=400', category: 'Sashimi' },
      { id: 'm2b', name: 'Midnight Miso', description: 'Dark miso with charred tofu and seaweed.', price: 7.50, image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&q=80&w=400', category: 'Appetizers' },
    ]
  },
  {
    id: '2',
    name: 'Obsidian Burger Lab',
    rating: 4.9,
    deliveryTime: '15-25 min',
    deliveryFee: 1.50,
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&q=80&w=800',
    categories: ['Burger', 'American', 'Gourmet'],
    menu: [
      { id: 'm3', name: 'Truffle Void Burger', description: 'Black brioche, wagyu beef, truffle aioli.', price: 24.00, image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&q=80&w=400', category: 'Burger' },
      { id: 'm4', name: 'Midnight Fries', description: 'Purple potatoes with charcoal salt.', price: 8.00, image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&q=80&w=400', category: 'Sides' },
      { id: 'm4b', name: 'Lava Cake', description: 'Molten center dark chocolate cake.', price: 12.00, image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=400', category: 'Dessert' },
    ]
  },
  {
    id: '3',
    name: 'Lush Greenery Bowl',
    rating: 4.6,
    deliveryTime: '10-20 min',
    deliveryFee: 0.00,
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800',
    categories: ['Salad', 'Healthy', 'Vegan'],
    isFeatured: true,
    menu: [
      { id: 'm5', name: 'Superfood Zenith', description: 'Quinoa, kale, pomegranate, tahini.', price: 16.00, image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400', category: 'Salad' },
      { id: 'm5b', name: 'Detox Green Juice', description: 'Kale, apple, ginger, and lemon.', price: 9.00, image: 'https://images.unsplash.com/photo-1610970881699-44a55b61bb5c?auto=format&fit=crop&q=80&w=400', category: 'Drinks' },
    ]
  },
  {
    id: '4',
    name: 'Inferno Pizza Co.',
    rating: 4.7,
    deliveryTime: '25-35 min',
    deliveryFee: 3.50,
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=800',
    categories: ['Pizza', 'Italian'],
    menu: [
      { id: 'm6', name: 'Vulcan Pepperoni', description: 'Double spicy pepperoni, honey chili oil.', price: 19.99, image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400', category: 'Pizza' },
      { id: 'm7', name: 'Cheesy Garlic Stars', description: 'Star-shaped dough with herb butter.', price: 11.50, image: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?auto=format&fit=crop&q=80&w=400', category: 'Appetizers' },
    ]
  },
  {
    id: '5',
    name: 'Spice Route Delhi',
    rating: 4.9,
    deliveryTime: '30-40 min',
    deliveryFee: 1.99,
    image: 'https://images.unsplash.com/photo-1585937421612-71100e957b7d?auto=format&fit=crop&q=80&w=800',
    categories: ['Indian', 'Curry', 'Spicy'],
    menu: [
      { id: 'm8', name: 'Golden Butter Chicken', description: 'Aromatic cream sauce with tender chicken.', price: 17.00, image: 'https://images.unsplash.com/photo-1603894584115-f73f2ec851ad?auto=format&fit=crop&q=80&w=400', category: 'Curry' },
    ]
  },
  {
    id: '6',
    name: 'Taco Universe',
    rating: 4.5,
    deliveryTime: '15-20 min',
    deliveryFee: 0.99,
    image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&q=80&w=800',
    categories: ['Tacos', 'Mexican', 'Fast Food'],
    menu: [
      { id: 'm9', name: 'Al Pastor Cosmic Taco', description: 'Pineapple glazed pork with neon salsa.', price: 4.50, image: 'https://images.unsplash.com/photo-1552332386-f8dd00dc2f85?auto=format&fit=crop&q=80&w=400', category: 'Tacos' },
    ]
  }
];
