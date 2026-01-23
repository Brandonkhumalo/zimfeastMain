package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class Order {
    @SerializedName("id")
    private String id;

    @SerializedName("restaurantId")
    private String restaurantId;

    @SerializedName("restaurant_names")
    private List<String> restaurantNames;

    @SerializedName("items")
    private List<OrderItem> items;

    @SerializedName("each_item_price")
    private List<OrderItem> eachItemPrice;

    @SerializedName("subtotal")
    private double subtotal;

    @SerializedName("delivery_fee")
    private double deliveryFee;

    @SerializedName("total_fee")
    private double total;
    
    @SerializedName("tip")
    private double tip;

    @SerializedName("status")
    private String status;

    @SerializedName("deliveryCoordinates")
    private Restaurant.Coordinates deliveryCoordinates;

    @SerializedName("delivery_address")
    private String deliveryAddress;

    @SerializedName("currency")
    private String currency;

    @SerializedName("driver")
    private Driver driver;

    @SerializedName("created")
    private String createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRestaurantId() { return restaurantId; }
    public void setRestaurantId(String restaurantId) { this.restaurantId = restaurantId; }

    public String getRestaurantName() { 
        if (restaurantNames == null || restaurantNames.isEmpty()) return "";
        return String.join(", ", restaurantNames);
    }
    public List<String> getRestaurantNames() { return restaurantNames; }
    public void setRestaurantNames(List<String> restaurantNames) { this.restaurantNames = restaurantNames; }

    public List<OrderItem> getItems() {
        if (items != null && !items.isEmpty()) return items;
        return eachItemPrice;
    }
    public void setItems(List<OrderItem> items) { this.items = items; }

    public double getSubtotal() { 
        if (subtotal > 0) return subtotal;
        double computed = 0;
        if (getItems() != null) {
            for (OrderItem item : getItems()) {
                computed += item.getPrice() * item.getQuantity();
            }
        }
        return computed;
    }
    public void setSubtotal(double subtotal) { this.subtotal = subtotal; }

    public double getDeliveryFee() { return deliveryFee; }
    public void setDeliveryFee(double deliveryFee) { this.deliveryFee = deliveryFee; }

    public double getTotal() { return total; }
    public void setTotal(double total) { this.total = total; }
    
    public double getTip() { return tip; }
    public void setTip(double tip) { this.tip = tip; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public Restaurant.Coordinates getDeliveryCoordinates() { return deliveryCoordinates; }
    public void setDeliveryCoordinates(Restaurant.Coordinates deliveryCoordinates) {
        this.deliveryCoordinates = deliveryCoordinates;
    }

    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }

    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }

    public Driver getDriver() { return driver; }
    public void setDriver(Driver driver) { this.driver = driver; }

    public String getCreatedAt() { return createdAt; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }

    public static class OrderItem {
        @SerializedName("id")
        private String id;

        @SerializedName("name")
        private String name;

        @SerializedName("price")
        private double price;

        @SerializedName("quantity")
        private int quantity;
        
        @SerializedName("menu_item")
        private MenuItem menuItem;

        public String getId() { return id; }
        public String getName() { 
            if (name != null && !name.isEmpty()) return name;
            if (menuItem != null) return menuItem.getName();
            return "Unknown Item";
        }
        public double getPrice() { 
            if (price > 0) return price;
            if (menuItem != null) return menuItem.getPrice();
            return 0;
        }
        public int getQuantity() { return quantity > 0 ? quantity : 1; }
    }
    
    public static class MenuItem {
        @SerializedName("id")
        private String id;
        
        @SerializedName("name")
        private String name;
        
        @SerializedName("price")
        private double price;
        
        public String getId() { return id; }
        public String getName() { return name; }
        public double getPrice() { return price; }
    }

    public static class Driver {
        @SerializedName("name")
        private String name;

        @SerializedName("phone")
        private String phone;

        @SerializedName("vehicle")
        private String vehicle;

        @SerializedName("coordinates")
        private Restaurant.Coordinates coordinates;

        public String getName() { return name; }
        public String getPhone() { return phone; }
        public String getVehicle() { return vehicle; }
        public Restaurant.Coordinates getCoordinates() { return coordinates; }
    }
}
