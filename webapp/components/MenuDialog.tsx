import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Restaurant, MenuItem as MenuItemType } from "@/pages/customer-components/types";

interface MenuDialogProps {
  restaurant: Restaurant | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: any) => void;
  currency: string;
}

export default function MenuDialog({
  restaurant,
  isOpen,
  onClose,
  onAddToCart,
  currency,
}: MenuDialogProps) {
  const getCurrencySymbol = (curr: string) => (curr === "USD" ? "$" : "Z$");

  if (!restaurant) return null;

  const menuItems = restaurant.menu_items || [];

  const handleAddToCart = (menuItem: MenuItemType) => {
    onAddToCart({
      id: menuItem.id,
      name: menuItem.name,
      price: parseFloat(menuItem.price),
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      restaurantLat: restaurant.lat,
      restaurantLng: restaurant.lng,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            {restaurant.name} - Menu
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {restaurant.description}
          </p>
          <div className="flex items-center gap-4 pt-2">
            <span className="text-sm">
              <i className="fas fa-star text-yellow-500 mr-1"></i>
              {restaurant.rating || "4.5"}
            </span>
            <span className="text-sm">
              <i className="fas fa-clock mr-1"></i>
              {restaurant.est_delivery_time}
            </span>
            <span className="text-sm">
              <i className="fas fa-dollar-sign mr-1"></i>
              Min order: {getCurrencySymbol(currency)}
              {restaurant.minimum_order_price}
            </span>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          {menuItems.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <i className="fas fa-utensils text-4xl mb-4"></i>
              <p>No menu items available yet</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-4 p-4 border rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="w-24 h-24 bg-gray-200 rounded-lg flex-shrink-0 flex items-center justify-center overflow-hidden">
                    {item.item_image ? (
                      <img
                        src={item.item_image}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <i className="fas fa-utensils text-2xl text-gray-400"></i>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h3 className="font-semibold text-lg">{item.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">
                          {getCurrencySymbol(currency)}
                          {parseFloat(item.price).toFixed(2)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        {item.category.map((cat, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs">
                            {cat}
                          </Badge>
                        ))}
                        {item.prep_time && (
                          <span className="text-xs text-muted-foreground">
                            <i className="fas fa-clock mr-1"></i>
                            {item.prep_time} min
                          </span>
                        )}
                        {!item.available && (
                          <Badge variant="destructive" className="text-xs">
                            Unavailable
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleAddToCart(item)}
                        disabled={!item.available}
                      >
                        <i className="fas fa-plus mr-2"></i>
                        Add to Cart
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
