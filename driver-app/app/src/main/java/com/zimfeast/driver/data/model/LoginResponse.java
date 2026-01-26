package com.zimfeast.driver.data.model;

import com.google.gson.annotations.SerializedName;

public class LoginResponse {
    @SerializedName("accessToken")
    private String token;
    
    @SerializedName("refreshToken")
    private String refreshToken;
    
    @SerializedName("role")
    private String role;
    
    public String getToken() { return token; }
    public String getRefreshToken() { return refreshToken; }
    public String getRole() { return role; }
}
