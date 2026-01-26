package com.zimfeast.driver.data.model;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class Order {
    @SerializedName("id")
    private String id;

    @SerializedName("customer_name")
    private String customerName;

    @SerializedName("customer_phone")
    private String customerPhone;

    @SerializedName("restaurant_names")
    private List<String> restaurantNames;

    @SerializedName("delivery_address")
    private String deliveryAddress;

    @SerializedName("delivery_lat")
    private double deliveryLat;

    @SerializedName("delivery_lng")
    private double deliveryLng;

    @SerializedName("subtotal")
    private double subtotal;

    @SerializedName("delivery_fee")
    private double deliveryFee;

    @SerializedName("tip")
    private double tip;

    @SerializedName("total_fee")
    private double total;

    @SerializedName("status")
    private String status;

    @SerializedName("created")
    private String created;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerPhone() { return customerPhone; }
    public void setCustomerPhone(String customerPhone) { this.customerPhone = customerPhone; }

    public String getRestaurantName() {
        if (restaurantNames == null || restaurantNames.isEmpty()) return "";
        return String.join(", ", restaurantNames);
    }

    public String getDeliveryAddress() { return deliveryAddress; }
    public void setDeliveryAddress(String deliveryAddress) { this.deliveryAddress = deliveryAddress; }

    public double getDeliveryLat() { return deliveryLat; }
    public void setDeliveryLat(double deliveryLat) { this.deliveryLat = deliveryLat; }

    public double getDeliveryLng() { return deliveryLng; }
    public void setDeliveryLng(double deliveryLng) { this.deliveryLng = deliveryLng; }

    public double getSubtotal() { return subtotal; }
    public void setSubtotal(double subtotal) { this.subtotal = subtotal; }

    public double getDeliveryFee() { return deliveryFee; }
    public void setDeliveryFee(double deliveryFee) { this.deliveryFee = deliveryFee; }

    public double getTip() { return tip; }
    public void setTip(double tip) { this.tip = tip; }

    public double getTotal() { return total; }
    public void setTotal(double total) { this.total = total; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public String getCreated() { return created; }
    public void setCreated(String created) { this.created = created; }

    public double getDriverEarnings() {
        return deliveryFee + tip;
    }

    public String getFormattedEarnings() {
        return String.format("$%.2f", getDriverEarnings());
    }
}
