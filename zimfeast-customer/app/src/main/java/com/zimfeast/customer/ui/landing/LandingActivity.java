package com.zimfeast.customer.ui.landing;

import android.content.Intent;
import android.os.Bundle;

import androidx.appcompat.app.AppCompatActivity;

import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.databinding.ActivityLandingBinding;
import com.zimfeast.customer.ui.auth.LoginActivity;
import com.zimfeast.customer.ui.auth.RegisterActivity;
import com.zimfeast.customer.ui.customer.CustomerActivity;

public class LandingActivity extends AppCompatActivity {

    private ActivityLandingBinding binding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityLandingBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        if (ApiClient.getInstance().getTokenManager().isLoggedIn()) {
            startActivity(new Intent(this, CustomerActivity.class));
            finish();
            return;
        }

        setupClickListeners();
    }

    private void setupClickListeners() {
        binding.btnGetStarted.setOnClickListener(v -> {
            startActivity(new Intent(this, RegisterActivity.class));
        });

        binding.btnLogin.setOnClickListener(v -> {
            startActivity(new Intent(this, LoginActivity.class));
        });

        binding.btnBottomGetStarted.setOnClickListener(v -> {
            startActivity(new Intent(this, RegisterActivity.class));
        });
    }
}
