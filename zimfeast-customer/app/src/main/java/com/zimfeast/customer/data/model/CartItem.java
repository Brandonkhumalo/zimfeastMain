package com.zimfeast.customer.data.model;

import androidx.room.Entity;
import androidx.room.PrimaryKey;
import androidx.annotation.NonNull;

@Entity(tableName = "cart_items")
public class CartItem {
    @PrimaryKey
    @NonNull
    private String id;

    private String name;
    private double price;
    private int quantity;
    private String restaurantId;
    private String restaurantName;
    private String imageUrl;

    public CartItem() {
        this.id = "";
    }

    public CartItem(@NonNull String id, String name, double price, int quantity,
                    String restaurantId, String restaurantName) {
        this.id = id;
        this.name = name;
        this.price = price;
        this.quantity = quantity;
        this.restaurantId = restaurantId;
        this.restaurantName = restaurantName;
    }

    @NonNull
    public String getId() { return id; }
    public void setId(@NonNull String id) { this.id = id; }

    // Alias methods for compatibility
    @NonNull
    public String getItemId() { return id; }
    public void setItemId(@NonNull String itemId) { this.id = itemId; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public double getPrice() { return price; }
    public void setPrice(double price) { this.price = price; }

    public int getQuantity() { return quantity; }
    public void setQuantity(int quantity) { this.quantity = quantity; }

    public String getRestaurantId() { return restaurantId; }
    public void setRestaurantId(String restaurantId) { this.restaurantId = restaurantId; }

    public String getRestaurantName() { return restaurantName; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public double getTotalPrice() {
        return price * quantity;
    }
}
