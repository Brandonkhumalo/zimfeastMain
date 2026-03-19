package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;
import java.util.List;

public class MenuItem {

    @SerializedName("id")
    private String id;

    @SerializedName("restaurant")
    private String restaurant;

    @SerializedName("name")
    private String name;

    @SerializedName("description")
    private String description;

    // Backend sends price as STRING
    @SerializedName("price")
    private String price;

    // FIXED: correct backend field
    @SerializedName("item_image")
    private String itemImage;

    @SerializedName("available")
    private boolean available;

    // FIXED: backend sends ARRAY
    @SerializedName("category")
    private List<String> category;

    @SerializedName("prep_time")
    private int prepTime;

    @SerializedName("created")
    private String created;

    // -------- Getters --------

    public String getId() {
        return id;
    }

    public String getRestaurant() {
        return restaurant;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public double getPrice() {
        try {
            return Double.parseDouble(price);
        } catch (Exception e) {
            return 0.0;
        }
    }

    public String getItemImage() {
        return itemImage;
    }

    public boolean isAvailable() {
        return available;
    }

    public List<String> getCategory() {
        return category;
    }

    public String getCategoryDisplay() {
        return category != null && !category.isEmpty()
                ? category.get(0)
                : "";
    }

    public int getPrepTime() {
        return prepTime;
    }

    public String getCreated() {
        return created;
    }
}
