package com.zimfeast.customer.ui.splash;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import androidx.appcompat.app.AppCompatActivity;

import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.model.User;
import com.zimfeast.customer.ui.customer.CustomerActivity;
import com.zimfeast.customer.ui.landing.LandingActivity;
import com.zimfeast.customer.util.TokenManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class SplashActivity extends AppCompatActivity {

    private static final String TAG = "SplashActivity";
    private TokenManager tokenManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        tokenManager = ApiClient.getInstance().getTokenManager();

        new Handler(Looper.getMainLooper()).postDelayed(this::checkAuthentication, 1500);
    }

    private void checkAuthentication() {
        if (!tokenManager.isLoggedIn()) {
            navigateToLanding();
            return;
        }

        if (!tokenManager.isTokenValid()) {
            Log.d(TAG, "Token expired, clearing and redirecting to login");
            tokenManager.clearAll();
            navigateToLanding();
            return;
        }

        verifyTokenWithBackend();
    }

    private void verifyTokenWithBackend() {
        ApiClient.getInstance().getApiService().getProfile().enqueue(new Callback<User>() {
            @Override
            public void onResponse(Call<User> call, Response<User> response) {
                if (response.isSuccessful() && response.body() != null) {
                    Log.d(TAG, "Token verified successfully");
                    User user = response.body();
                    tokenManager.saveUserName(user.getFirstName() + " " + user.getLastName());
                    tokenManager.saveUserEmail(user.getEmail());
                    navigateToCustomer();
                } else if (response.code() == 401 || response.code() == 403) {
                    Log.d(TAG, "Token invalid (401/403), clearing and redirecting to login");
                    tokenManager.clearAll();
                    navigateToLanding();
                } else {
                    Log.d(TAG, "Backend error, proceeding with cached token");
                    navigateToCustomer();
                }
            }

            @Override
            public void onFailure(Call<User> call, Throwable t) {
                Log.e(TAG, "Network error during token verification", t);
                if (tokenManager.isTokenValid()) {
                    navigateToCustomer();
                } else {
                    navigateToLanding();
                }
            }
        });
    }

    private void navigateToLanding() {
        startActivity(new Intent(this, LandingActivity.class));
        finish();
    }

    private void navigateToCustomer() {
        startActivity(new Intent(this, CustomerActivity.class));
        finish();
    }
}
