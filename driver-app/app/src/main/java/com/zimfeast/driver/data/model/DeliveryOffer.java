package com.zimfeast.driver.data.model;

public class DeliveryOffer {
    private String orderId;
    private String restaurantName;
    private double restaurantLat;
    private double restaurantLng;
    private String dropoffAddress;
    private double dropoffLat;
    private double dropoffLng;
    private String distance;
    private double total;
    private double tip;
    private int expiresIn;
    
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    
    public String getRestaurantName() { return restaurantName; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }
    
    public double getRestaurantLat() { return restaurantLat; }
    public void setRestaurantLat(double restaurantLat) { this.restaurantLat = restaurantLat; }
    
    public double getRestaurantLng() { return restaurantLng; }
    public void setRestaurantLng(double restaurantLng) { this.restaurantLng = restaurantLng; }
    
    public String getDropoffAddress() { return dropoffAddress; }
    public void setDropoffAddress(String dropoffAddress) { this.dropoffAddress = dropoffAddress; }
    
    public double getDropoffLat() { return dropoffLat; }
    public void setDropoffLat(double dropoffLat) { this.dropoffLat = dropoffLat; }
    
    public double getDropoffLng() { return dropoffLng; }
    public void setDropoffLng(double dropoffLng) { this.dropoffLng = dropoffLng; }
    
    public String getDistance() { return distance; }
    public void setDistance(String distance) { this.distance = distance; }
    
    public double getTotal() { return total; }
    public void setTotal(double total) { this.total = total; }
    
    public double getTip() { return tip; }
    public void setTip(double tip) { this.tip = tip; }
    
    public int getExpiresIn() { return expiresIn; }
    public void setExpiresIn(int expiresIn) { this.expiresIn = expiresIn; }
    
    public double getTotalEarnings() {
        return total * 0.15 + tip;
    }
}
