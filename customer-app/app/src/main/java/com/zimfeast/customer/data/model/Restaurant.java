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

    @SerializedName(value = "estimatedDeliveryTime", alternate = {"est_delivery_time"})
    private String estimatedDeliveryTime;

    @SerializedName("coordinates")
    private Coordinates coordinates;

    @SerializedName("lat")
    private Double lat;

    @SerializedName("lng")
    private Double lng;

    @SerializedName("isOpen")
    private boolean isOpen;

    @SerializedName(value = "address", alternate = {"full_address"})
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

    public int getEstimatedDeliveryTime() { 
        if (estimatedDeliveryTime == null) return 30;
        try {
            return Integer.parseInt(estimatedDeliveryTime.replaceAll("[^0-9]", "").split("")[0] + 
                   (estimatedDeliveryTime.replaceAll("[^0-9]", "").length() > 1 ? 
                    estimatedDeliveryTime.replaceAll("[^0-9]", "").substring(0, 2) : "0"));
        } catch (Exception e) {
            return 30;
        }
    }
    public void setEstimatedDeliveryTime(String estimatedDeliveryTime) { this.estimatedDeliveryTime = estimatedDeliveryTime; }

    public Coordinates getCoordinates() { 
        if (coordinates != null) return coordinates;
        if (lat != null && lng != null) {
            Coordinates coords = new Coordinates();
            coords.setLat(lat);
            coords.setLng(lng);
            return coords;
        }
        return null;
    }
    public void setCoordinates(Coordinates coordinates) { this.coordinates = coordinates; }

    public Double getLat() { 
        if (lat != null) return lat;
        if (coordinates != null) return coordinates.getLat();
        return null;
    }
    public void setLat(Double lat) { this.lat = lat; }

    public Double getLng() { 
        if (lng != null) return lng;
        if (coordinates != null) return coordinates.getLng();
        return null;
    }
    public void setLng(Double lng) { this.lng = lng; }

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
        int base = getEstimatedDeliveryTime();
        return base + "-" + (base + 10) + " min";
    }
}
