package com.zimfeast.customer.data.model;

import androidx.room.Entity;
import androidx.room.PrimaryKey;

import com.google.gson.annotations.SerializedName;

/**
 * Represents a saved delivery address. This model is used both for the API
 * response (Gson deserialization) and for local Room caching (offline access).
 */
@Entity(tableName = "addresses")
public class Address {

    @PrimaryKey
    @androidx.annotation.NonNull
    @SerializedName("id")
    private String id;

    @SerializedName("label")
    private String label;

    @SerializedName("address_text")
    private String addressText;

    @SerializedName("lat")
    private double lat;

    @SerializedName("lng")
    private double lng;

    @SerializedName("created")
    private String created;

    public Address() {}

    public Address(@androidx.annotation.NonNull String id, String label, String addressText, double lat, double lng) {
        this.id = id;
        this.label = label;
        this.addressText = addressText;
        this.lat = lat;
        this.lng = lng;
    }

    @androidx.annotation.NonNull
    public String getId() { return id; }
    public void setId(@androidx.annotation.NonNull String id) { this.id = id; }

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }

    public String getAddressText() { return addressText; }
    public void setAddressText(String addressText) { this.addressText = addressText; }

    public double getLat() { return lat; }
    public void setLat(double lat) { this.lat = lat; }

    public double getLng() { return lng; }
    public void setLng(double lng) { this.lng = lng; }

    public String getCreated() { return created; }
    public void setCreated(String created) { this.created = created; }
}
