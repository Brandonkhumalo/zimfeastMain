package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;

public class PaymentResponse {
    @SerializedName("success")
    private boolean success;

    @SerializedName("paynow_url")
    private String redirectUrl;

    @SerializedName("poll_url")
    private String pollUrl;

    @SerializedName("message")
    private String message;

    @SerializedName("status")
    private String status;

    @SerializedName("direct_payment")
    private boolean directPayment;

    @SerializedName("voucher_used")
    private String voucherUsed;

    @SerializedName("paynow_amount")
    private String paynowAmount;

    @SerializedName("reference")
    private String reference;

    @SerializedName("error")
    private String error;

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

    public boolean isDirectPayment() { return directPayment; }
    public void setDirectPayment(boolean directPayment) { this.directPayment = directPayment; }

    public String getVoucherUsed() { return voucherUsed; }
    public void setVoucherUsed(String voucherUsed) { this.voucherUsed = voucherUsed; }

    public String getPaynowAmount() { return paynowAmount; }
    public void setPaynowAmount(String paynowAmount) { this.paynowAmount = paynowAmount; }

    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }

    public String getError() { return error; }
    public void setError(String error) { this.error = error; }
}
