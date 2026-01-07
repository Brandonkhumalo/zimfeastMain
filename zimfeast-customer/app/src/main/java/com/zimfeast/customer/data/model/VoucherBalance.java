package com.zimfeast.customer.data.model;

import com.google.gson.annotations.SerializedName;

public class VoucherBalance {
    @SerializedName("balance")
    private double balance;

    public double getBalance() { return balance; }
    public void setBalance(double balance) { this.balance = balance; }
}
