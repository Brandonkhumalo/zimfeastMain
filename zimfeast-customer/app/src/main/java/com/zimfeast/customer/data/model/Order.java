package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class Order {
    @SerializedName("id")
    private String id;

    @SerializedName("restaurantId")
    private String restaurantId;

    @SerializedName("restaurant_names")
    private String restaurantName;

    @SerializedName("items")
    private List<OrderItem> items;

    @SerializedName("each_item_price")
    private List<OrderItem> eachItemPrice;

    @SerializedName("subtotal")
    private double subtotal;

    @SerializedName("deliveryFee")
    private double deliveryFee;

    @SerializedName("total")
    private double total;

    @SerializedName("status")
    private String status;

    @SerializedName("deliveryCoordinates")
    private Restaurant.Coordinates deliveryCoordinates;

    @SerializedName("deliveryAddress")
    private String deliveryAddress;

    @SerializedName("currency")
    private String currency;

    @SerializedName("driver")
    private Driver driver;

    @SerializedName("createdAt")
    private String createdAt;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRestaurantId() { return restaurantId; }
    public void setRestaurantId(String restaurantId) { this.restaurantId = restaurantId; }

    public String getRestaurantName() { return restaurantName; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }

    public List<OrderItem> getItems() {
        if (items != null && !items.isEmpty()) return items;
        return eachItemPrice;
    }
    public void setItems(List<OrderItem> items) { this.items = items; }

    public double getSubtotal() { return subtotal; }
    public void setSubtotal(double subtotal) { this.subtotal = subtotal; }

    public double getDeliveryFee() { return deliveryFee; }
    public void setDeliveryFee(double deliveryFee) { this.deliveryFee = deliveryFee; }

    public double getTotal() { return total; }
    public void setTotal(double total) { this.total = total; }

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

        public String getId() { return id; }
        public String getName() { return name; }
        public double getPrice() { return price; }
        public int getQuantity() { return quantity; }
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
