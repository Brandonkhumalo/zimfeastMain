package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;

public class PaymentRequest {
    @SerializedName("order_id")
    private String orderId;

    @SerializedName("method")
    private String method;

    @SerializedName("phone")
    private String phone;

    @SerializedName("provider")
    private String provider;

    public PaymentRequest(String orderId, String method) {
        this.orderId = orderId;
        this.method = method;
    }

    public PaymentRequest(String orderId, String method, String phone, String provider) {
        this.orderId = orderId;
        this.method = method;
        this.phone = phone;
        this.provider = provider;
    }

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }

    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
}
