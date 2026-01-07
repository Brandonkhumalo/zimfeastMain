package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;

public class PaymentResponse {
    @SerializedName("success")
    private boolean success;

    @SerializedName("redirect_url")
    private String redirectUrl;

    @SerializedName("poll_url")
    private String pollUrl;

    @SerializedName("message")
    private String message;

    @SerializedName("status")
    private String status;

    public boolean isSuccess() { return success; }
    public void setSuccess(boolean success) { this.success = success; }

    public String getRedirectUrl() { return redirectUrl; }
    public void setRedirectUrl(String redirectUrl) { this.redirectUrl = redirectUrl; }

    public String getPollUrl() { return pollUrl; }
    public void setPollUrl(String pollUrl) { this.pollUrl = pollUrl; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
}
