package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;

public class Restaurant {
    @SerializedName("id")
    private String id;

    @SerializedName("name")
    private String name;

    @SerializedName("description")
    private String description;

    @SerializedName("cuisineType")
    private String cuisineType;

    @SerializedName("imageUrl")
    private String imageUrl;

    @SerializedName("rating")
    private double rating;

    @SerializedName("estimatedDeliveryTime")
    private int estimatedDeliveryTime;

    @SerializedName("coordinates")
    private Coordinates coordinates;

    @SerializedName("isOpen")
    private boolean isOpen;

    @SerializedName("address")
    private String address;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getCuisineType() { return cuisineType; }
    public void setCuisineType(String cuisineType) { this.cuisineType = cuisineType; }

    public String getImageUrl() { return imageUrl; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }

    public double getRating() { return rating; }
    public void setRating(double rating) { this.rating = rating; }

    public int getEstimatedDeliveryTime() { return estimatedDeliveryTime; }
    public void setEstimatedDeliveryTime(int estimatedDeliveryTime) { this.estimatedDeliveryTime = estimatedDeliveryTime; }

    public Coordinates getCoordinates() { return coordinates; }
    public void setCoordinates(Coordinates coordinates) { this.coordinates = coordinates; }

    public boolean isOpen() { return isOpen; }
    public void setOpen(boolean open) { isOpen = open; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public static class Coordinates {
        @SerializedName("lat")
        private double lat;

        @SerializedName("lng")
        private double lng;

        public double getLat() { return lat; }
        public void setLat(double lat) { this.lat = lat; }

        public double getLng() { return lng; }
        public void setLng(double lng) { this.lng = lng; }
    }

    public String getFormattedCuisine() {
        if (cuisineType == null) return "";
        String formatted = cuisineType.replace("_", " ");
        return formatted.substring(0, 1).toUpperCase() + formatted.substring(1);
    }

    public String getDeliveryTimeRange() {
        int base = estimatedDeliveryTime > 0 ? estimatedDeliveryTime : 30;
        return base + "-" + (base + 10) + " min";
    }
}
