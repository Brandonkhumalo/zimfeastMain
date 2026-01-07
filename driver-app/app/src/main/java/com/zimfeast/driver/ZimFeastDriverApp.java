package com.zimfeast.driver;

import android.app.Application;
import android.content.SharedPreferences;

public class ZimFeastDriverApp extends Application {
    
    private static ZimFeastDriverApp instance;
    private SharedPreferences preferences;
    
    public static final String PREFS_NAME = "ZimFeastDriverPrefs";
    public static final String KEY_DRIVER_ID = "driver_id";
    public static final String KEY_DRIVER_NAME = "driver_name";
    public static final String KEY_DRIVER_PHONE = "driver_phone";
    public static final String KEY_DRIVER_VEHICLE = "driver_vehicle";
    public static final String KEY_AUTH_TOKEN = "auth_token";
    public static final String KEY_IS_ONLINE = "is_online";
    
    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        preferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
    }
    
    public static ZimFeastDriverApp getInstance() {
        return instance;
    }
    
    public SharedPreferences getPreferences() {
        return preferences;
    }
    
    public void saveDriverInfo(String driverId, String name, String phone, String vehicle, String token) {
        preferences.edit()
            .putString(KEY_DRIVER_ID, driverId)
            .putString(KEY_DRIVER_NAME, name)
            .putString(KEY_DRIVER_PHONE, phone)
            .putString(KEY_DRIVER_VEHICLE, vehicle)
            .putString(KEY_AUTH_TOKEN, token)
            .apply();
    }
    
    public String getDriverId() {
        return preferences.getString(KEY_DRIVER_ID, null);
    }
    
    public String getDriverName() {
        return preferences.getString(KEY_DRIVER_NAME, "Driver");
    }
    
    public String getDriverPhone() {
        return preferences.getString(KEY_DRIVER_PHONE, "");
    }
    
    public String getDriverVehicle() {
        return preferences.getString(KEY_DRIVER_VEHICLE, "Car");
    }
    
    public String getAuthToken() {
        return preferences.getString(KEY_AUTH_TOKEN, null);
    }
    
    public boolean isOnline() {
        return preferences.getBoolean(KEY_IS_ONLINE, false);
    }
    
    public void setOnline(boolean online) {
        preferences.edit().putBoolean(KEY_IS_ONLINE, online).apply();
    }
    
    public void logout() {
        preferences.edit().clear().apply();
    }
}
