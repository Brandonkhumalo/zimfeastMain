package com.zimfeast.driver.data.model;

import com.google.gson.annotations.SerializedName;

public class TokenRefreshRequest {
    @SerializedName("refresh")
    private String refresh;

    public TokenRefreshRequest(String refresh) {
        this.refresh = refresh;
    }

    public String getRefresh() { return refresh; }
    public void setRefresh(String refresh) { this.refresh = refresh; }
}
