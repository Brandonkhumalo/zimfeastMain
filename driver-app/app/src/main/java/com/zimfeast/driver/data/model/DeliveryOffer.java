package com.zimfeast.driver.data.model;

public class DeliveryOffer {
    private String orderId;
    private String restaurantName;
    private String restaurantAddress;
    private double restaurantLat;
    private double restaurantLng;
    private String customerName;
    private String customerPhone;
    private String dropoffAddress;
    private double dropoffLat;
    private double dropoffLng;
    private String distanceToRestaurant;
    private String distanceToCustomer;
    private String totalDistance;
    private String deliveryPrice;
    private double total;
    private double tip;
    private int expiresIn;
    
    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    
    public String getRestaurantName() { return restaurantName; }
    public void setRestaurantName(String restaurantName) { this.restaurantName = restaurantName; }
    
    public String getRestaurantAddress() { return restaurantAddress; }
    public void setRestaurantAddress(String restaurantAddress) { this.restaurantAddress = restaurantAddress; }
    
    public double getRestaurantLat() { return restaurantLat; }
    public void setRestaurantLat(double restaurantLat) { this.restaurantLat = restaurantLat; }
    
    public double getRestaurantLng() { return restaurantLng; }
    public void setRestaurantLng(double restaurantLng) { this.restaurantLng = restaurantLng; }
    
    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }
    
    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }
    
    public String getDropoffAddress() { return dropoffAddress; }
    public void setDropoffAddress(String dropoffAddress) { this.dropoffAddress = dropoffAddress; }
    
    public double getDropoffLat() { return dropoffLat; }
    public void setDropoffLat(double dropoffLat) { this.dropoffLat = dropoffLat; }
    
    public double getDropoffLng() { return dropoffLng; }
    public void setDropoffLng(double dropoffLng) { this.dropoffLng = dropoffLng; }
    
    public String getDistanceToRestaurant() { return distanceToRestaurant; }
    public void setDistanceToRestaurant(String distanceToRestaurant) { this.distanceToRestaurant = distanceToRestaurant; }
    
    public String getDistanceToCustomer() { return distanceToCustomer; }
    public void setDistanceToCustomer(String distanceToCustomer) { this.distanceToCustomer = distanceToCustomer; }
    
    public String getTotalDistance() { return totalDistance; }
    public void setTotalDistance(String totalDistance) { this.totalDistance = totalDistance; }
    
    public String getDeliveryPrice() { return deliveryPrice; }
    public void setDeliveryPrice(String deliveryPrice) { this.deliveryPrice = deliveryPrice; }
    
    public double getTotal() { return total; }
    public void setTotal(double total) { this.total = total; }
    
    public double getTip() { return tip; }
    public void setTip(double tip) { this.tip = tip; }
    
    public int getExpiresIn() { return expiresIn; }
    public void setExpiresIn(int expiresIn) { this.expiresIn = expiresIn; }
    
    public double getTotalEarnings() {
        try {
            return Double.parseDouble(deliveryPrice) + tip;
        } catch (NumberFormatException e) {
            return tip;
        }
    }
    
    public String getFormattedDistance() {
        return totalDistance + " km";
    }
    
    public String getFormattedEarnings() {
        return "$" + String.format("%.2f", getTotalEarnings());
    }
}
