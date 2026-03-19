package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;

public class CreateOrderResponse {
    @SerializedName("order")
    private Order order;

    public Order getOrder() {
        return order;
    }

    public void setOrder(Order order) {
        this.order = order;
    }
}
