import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { CartItem } from "@/pages/customer-components/types";

export function useCart() {
  const { toast } = useToast();

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem("zimfeast_cart");
    return saved ? JSON.parse(saved) : [];
  });

  // Persist cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem("zimfeast_cart", JSON.stringify(cartItems));
  }, [cartItems]);

  const addToCart = (item: CartItem) => {
    setCartItems((prev) => {
      // Check if cart has items from a different restaurant
      const currentRestaurantId = prev.length > 0 ? prev[0].restaurantId : null;
      if (currentRestaurantId && item.restaurantId && item.restaurantId !== currentRestaurantId) {
        // Ask user to confirm clearing the cart
        const confirmed = window.confirm(
          "Your cart has items from another restaurant. Clear cart and add this item?"
        );
        if (!confirmed) return prev;
        // Clear cart and add the new item
        return [{ ...item, quantity: 1 }];
      }

      const existing = prev.find((i) => i.id === item.id);
      if (existing) return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { ...item, quantity: 1 }];
    });
    toast({
      title: "Added to cart",
      description: `${item.name} added to your cart`,
      variant: "default",
    });
  };

  return { cartItems, setCartItems, isCartOpen, setIsCartOpen, addToCart };
}
