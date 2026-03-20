package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;

/**
 * Response model for GET /api/payments/referral/credits/
 * Contains count of available and used referral credits.
 */
public class ReferralCreditsResponse {
    @SerializedName("available_credits")
    private int availableCredits;

    @SerializedName("used_credits")
    private int usedCredits;

    @SerializedName("total_credits")
    private int totalCredits;

    @SerializedName("discount_pct")
    private String discountPct;

    public int getAvailableCredits() { return availableCredits; }
    public void setAvailableCredits(int availableCredits) { this.availableCredits = availableCredits; }

    public int getUsedCredits() { return usedCredits; }
    public void setUsedCredits(int usedCredits) { this.usedCredits = usedCredits; }

    public int getTotalCredits() { return totalCredits; }
    public void setTotalCredits(int totalCredits) { this.totalCredits = totalCredits; }

    public String getDiscountPct() { return discountPct; }
    public void setDiscountPct(String discountPct) { this.discountPct = discountPct; }
}
