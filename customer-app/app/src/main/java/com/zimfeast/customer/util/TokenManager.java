package com.zimfeast.customer.util;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import org.json.JSONObject;

public class TokenManager {
    private static final String PREF_NAME = "zimfeast_secure_prefs";
    private static final String KEY_TOKEN = "auth_token";
    private static final String KEY_REFRESH_TOKEN = "refresh_token";
    private static final String KEY_USER_ROLE = "user_role";
    private static final String KEY_USER_ID = "user_id";
    private static final String KEY_USER_EMAIL = "user_email";
    private static final String KEY_USER_NAME = "user_name";
    private static final String KEY_TOKEN_EXPIRY = "token_expiry";

    private final SharedPreferences prefs;

    public TokenManager(Context context) {
        SharedPreferences tempPrefs;
        try {
            MasterKey masterKey = new MasterKey.Builder(context)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();

            tempPrefs = EncryptedSharedPreferences.create(
                    context,
                    PREF_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            );
        } catch (Exception e) {
            tempPrefs = context.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        }
        prefs = tempPrefs;
    }

    public void saveToken(String token) {
        prefs.edit().putString(KEY_TOKEN, token).apply();
    }

    public String getToken() {
        return prefs.getString(KEY_TOKEN, null);
    }

    public void saveRefreshToken(String refreshToken) {
        prefs.edit().putString(KEY_REFRESH_TOKEN, refreshToken).apply();
    }

    public String getRefreshToken() {
        return prefs.getString(KEY_REFRESH_TOKEN, null);
    }

    public void saveUserRole(String role) {
        prefs.edit().putString(KEY_USER_ROLE, role).apply();
    }

    public String getUserRole() {
        return prefs.getString(KEY_USER_ROLE, null);
    }

    public void saveUserId(String userId) {
        prefs.edit().putString(KEY_USER_ID, userId).apply();
    }

    public String getUserId() {
        return prefs.getString(KEY_USER_ID, null);
    }

    public void saveUserEmail(String email) {
        prefs.edit().putString(KEY_USER_EMAIL, email).apply();
    }

    public String getUserEmail() {
        return prefs.getString(KEY_USER_EMAIL, null);
    }

    public void saveUserName(String name) {
        prefs.edit().putString(KEY_USER_NAME, name).apply();
    }

    public String getUserName() {
        return prefs.getString(KEY_USER_NAME, null);
    }

    public boolean isLoggedIn() {
        return getToken() != null && !getToken().isEmpty();
    }

    public boolean isTokenValid() {
        String token = getToken();
        if (token == null || token.isEmpty()) {
            return false;
        }
        
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return false;
            }
            
            String payloadBase64 = parts[1];
            int padding = (4 - payloadBase64.length() % 4) % 4;
            for (int i = 0; i < padding; i++) {
                payloadBase64 += "=";
            }
            
            String payload = new String(Base64.decode(payloadBase64, Base64.URL_SAFE | Base64.NO_WRAP));
            JSONObject json = new JSONObject(payload);
            
            if (json.has("exp")) {
                long expiry = json.getLong("exp");
                long currentTime = System.currentTimeMillis() / 1000;
                return currentTime < expiry;
            }
            
            return true;
        } catch (Exception e) {
            return true;
        }
    }

    public long getTokenExpiry() {
        String token = getToken();
        if (token == null || token.isEmpty()) {
            return 0;
        }
        
        try {
            String[] parts = token.split("\\.");
            if (parts.length != 3) {
                return 0;
            }
            
            String payloadBase64 = parts[1];
            int padding = (4 - payloadBase64.length() % 4) % 4;
            for (int i = 0; i < padding; i++) {
                payloadBase64 += "=";
            }
            
            String payload = new String(Base64.decode(payloadBase64, Base64.URL_SAFE | Base64.NO_WRAP));
            JSONObject json = new JSONObject(payload);
            
            if (json.has("exp")) {
                return json.getLong("exp");
            }
            
            return 0;
        } catch (Exception e) {
            return 0;
        }
    }

    // Biometric login support
    private static final String KEY_BIOMETRIC_ENABLED = "biometric_enabled";
    private static final String KEY_BIOMETRIC_PROMPTED = "biometric_prompted";

    public void setBiometricEnabled(boolean enabled) {
        prefs.edit().putBoolean(KEY_BIOMETRIC_ENABLED, enabled).apply();
    }

    public boolean isBiometricEnabled() {
        return prefs.getBoolean(KEY_BIOMETRIC_ENABLED, false);
    }

    public void setBiometricPrompted(boolean prompted) {
        prefs.edit().putBoolean(KEY_BIOMETRIC_PROMPTED, prompted).apply();
    }

    public boolean wasBiometricPrompted() {
        return prefs.getBoolean(KEY_BIOMETRIC_PROMPTED, false);
    }

    public void clearAll() {
        prefs.edit().clear().apply();
    }
}
