package com.zimfeast.driver.data.model;

import com.google.gson.annotations.SerializedName;

public class LoginResponse {
    @SerializedName("user_id")
    private String userId;
    
    @SerializedName("access")
    private String token;
    
    @SerializedName("role")
    private String role;
    
    @SerializedName("name")
    private String name;
    
    @SerializedName("phone")
    private String phone;
    
    @SerializedName("vehicle")
    private String vehicle;
    
    public String getUserId() { return userId; }
    public String getToken() { return token; }
    public String getRole() { return role; }
    public String getName() { return name; }
    public String getPhone() { return phone; }
    public String getVehicle() { return vehicle != null ? vehicle : "Car"; }
}
