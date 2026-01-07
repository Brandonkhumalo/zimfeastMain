package com.zimfeast.customer.util;

public class DeliveryUtils {
    public static final double DEFAULT_DELIVERY_FEE = 2.5;
    public static final double BASE_FEE = 1.5;
    public static final double PER_KM_RATE = 0.5;
    public static final double MIN_FEE = 1.5;
    public static final double MAX_FEE = 10.0;

    public static double calculateDistance(double lat1, double lng1, double lat2, double lng2) {
        final double EARTH_RADIUS_KM = 6371.0;

        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                        Math.sin(dLng / 2) * Math.sin(dLng / 2);

        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return EARTH_RADIUS_KM * c;
    }

    public static double calculateDeliveryFee(double userLat, double userLng,
                                               double restaurantLat, double restaurantLng) {
        double distance = calculateDistance(userLat, userLng, restaurantLat, restaurantLng);
        double fee = BASE_FEE + (distance * PER_KM_RATE);
        return Math.min(Math.max(fee, MIN_FEE), MAX_FEE);
    }

    public static String formatCurrency(double amount, String currency) {
        String symbol = "USD".equals(currency) ? "$" : "Z$";
        return symbol + String.format("%.2f", amount);
    }

    public static String normalizePhoneNumber(String phone) {
        String clean = phone.replaceAll("\\D", "");
        if (clean.startsWith("0")) {
            return "+263" + clean.substring(1);
        }
        if (clean.startsWith("263")) {
            return "+" + clean;
        }
        if (clean.startsWith("+")) {
            return clean;
        }
        return "+263" + clean;
    }
}
