package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;

/**
 * Response model for promo code validation.
 * Returned by POST /api/payments/promo/validate/
 */
public class PromoValidation {
    @SerializedName("code")
    private String code;

    @SerializedName("discount_type")
    private String discountType;

    @SerializedName("discount_value")
    private String discountValue;

    @SerializedName("discount_amount")
    private String discountAmount;

    @SerializedName("min_order_amount")
    private String minOrderAmount;

    @SerializedName("message")
    private String message;

    @SerializedName("detail")
    private String detail;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getDiscountType() { return discountType; }
    public void setDiscountType(String discountType) { this.discountType = discountType; }

    public String getDiscountValue() { return discountValue; }
    public void setDiscountValue(String discountValue) { this.discountValue = discountValue; }

    public String getDiscountAmount() { return discountAmount; }
    public void setDiscountAmount(String discountAmount) { this.discountAmount = discountAmount; }

    public String getMinOrderAmount() { return minOrderAmount; }
    public void setMinOrderAmount(String minOrderAmount) { this.minOrderAmount = minOrderAmount; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public String getDetail() { return detail; }
    public void setDetail(String detail) { this.detail = detail; }
}
