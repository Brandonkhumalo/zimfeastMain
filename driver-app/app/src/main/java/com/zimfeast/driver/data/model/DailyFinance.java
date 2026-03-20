package com.zimfeast.driver.data.model;

import com.google.gson.annotations.SerializedName;

/**
 * Model representing the driver's daily financial summary.
 * Maps to the GET /api/drivers/daily/finances/ endpoint response.
 */
public class DailyFinance {

    // Number of deliveries completed today
    @SerializedName("today_deliveries")
    private int todayDeliveries;

    // Total earnings (delivery fees) earned today in USD
    @SerializedName("today_earnings")
    private double todayEarnings;

    // Total tips received today in USD
    @SerializedName("today_tips")
    private double todayTips;

    // Hours the driver has been online today
    @SerializedName("hours_online")
    private double hoursOnline;

    // Average rating from today's deliveries (0.0 - 5.0 scale)
    @SerializedName("average_rating")
    private double averageRating;

    // --- Getters ---

    public int getTodayDeliveries() {
        return todayDeliveries;
    }

    public double getTodayEarnings() {
        return todayEarnings;
    }

    public double getTodayTips() {
        return todayTips;
    }

    public double getHoursOnline() {
        return hoursOnline;
    }

    public double getAverageRating() {
        return averageRating;
    }

    // --- Setters ---

    public void setTodayDeliveries(int todayDeliveries) {
        this.todayDeliveries = todayDeliveries;
    }

    public void setTodayEarnings(double todayEarnings) {
        this.todayEarnings = todayEarnings;
    }

    public void setTodayTips(double todayTips) {
        this.todayTips = todayTips;
    }

    public void setHoursOnline(double hoursOnline) {
        this.hoursOnline = hoursOnline;
    }

    public void setAverageRating(double averageRating) {
        this.averageRating = averageRating;
    }

    // --- Convenience methods ---

    /**
     * Returns formatted earnings string like "$12.50"
     */
    public String getFormattedEarnings() {
        return String.format("$%.2f", todayEarnings);
    }

    /**
     * Returns formatted tips string like "$3.00"
     */
    public String getFormattedTips() {
        return String.format("$%.2f", todayTips);
    }

    /**
     * Returns formatted hours string like "4.5 hrs"
     */
    public String getFormattedHours() {
        return String.format("%.1f hrs", hoursOnline);
    }
}
