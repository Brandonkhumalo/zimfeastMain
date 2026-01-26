package com.zimfeast.driver.data.model;

import com.google.gson.annotations.SerializedName;

public class ProfileResponse {
    @SerializedName("id")
    private String id;
    
    @SerializedName("email")
    private String email;
    
    @SerializedName("first_name")
    private String firstName;
    
    @SerializedName("last_name")
    private String lastName;
    
    @SerializedName("phone_number")
    private String phoneNumber;
    
    @SerializedName("role")
    private String role;
    
    public String getId() { return id; }
    public String getEmail() { return email; }
    public String getFirstName() { return firstName; }
    public String getLastName() { return lastName; }
    public String getPhoneNumber() { return phoneNumber; }
    public String getRole() { return role; }
    
    public String getFullName() {
        String first = firstName != null ? firstName : "";
        String last = lastName != null ? lastName : "";
        String name = (first + " " + last).trim();
        return name.isEmpty() ? "Driver" : name;
    }
}
