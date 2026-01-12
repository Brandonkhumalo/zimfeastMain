package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;

public class MenuItem {

    @SerializedName("id")
    private String id;

    @SerializedName("name")
    private String name;

    @SerializedName("description")
    private String description;

    @SerializedName("price")
    private Object price;

    @SerializedName("image_url")
    private String imageUrl;

    @SerializedName("available")
    private boolean available;

    @SerializedName("category")
    private String category;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public double getPrice() {
        if (price instanceof Number) {
            return ((Number) price).doubleValue();
        } else if (price instanceof String) {
            try {
                return Double.parseDouble((String) price);
            } catch (NumberFormatException ignored) {
            }
        }
        return 0.0;
    }

    public void setPrice(Object price) {
        this.price = price;
    }

    public String getImageUrl() {
        return imageUrl;
    }

    public void setImageUrl(String imageUrl) {
        this.imageUrl = imageUrl;
    }

    public boolean isAvailable() {
        return available;
    }

    public void setAvailable(boolean available) {
        this.available = available;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }
}
