package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;

/**
 * Response model for GET /api/payments/referral/code/
 * Contains user's unique referral code and share link.
 */
public class ReferralCodeResponse {
    @SerializedName("code")
    private String code;

    @SerializedName("share_link")
    private String shareLink;

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getShareLink() { return shareLink; }
    public void setShareLink(String shareLink) { this.shareLink = shareLink; }
}
