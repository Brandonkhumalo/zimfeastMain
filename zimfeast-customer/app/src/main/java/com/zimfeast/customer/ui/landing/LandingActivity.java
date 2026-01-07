package com.zimfeast.customer.ui.landing;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.databinding.ActivityLandingBinding;
import com.zimfeast.customer.ui.auth.LoginActivity;
import com.zimfeast.customer.ui.customer.CustomerActivity;

import java.util.Arrays;
import java.util.List;

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

        setupFeatures();
        setupClickListeners();
    }

    private void setupFeatures() {
        List<Feature> features = Arrays.asList(
                new Feature("Fast Delivery", "Quick delivery from your favorite local restaurants", "delivery"),
                new Feature("Local Cuisine", "Authentic Zimbabwean dishes and international favorites", "restaurant"),
                new Feature("Secure Payments", "Safe and secure payment options including USD and ZWL", "security")
        );

        FeaturesAdapter adapter = new FeaturesAdapter(features);
        binding.rvFeatures.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        binding.rvFeatures.setAdapter(adapter);
    }

    private void setupClickListeners() {
        binding.btnGetStarted.setOnClickListener(v -> {
            startActivity(new Intent(this, LoginActivity.class));
        });
    }

    public static class Feature {
        public String title;
        public String description;
        public String icon;

        public Feature(String title, String description, String icon) {
            this.title = title;
            this.description = description;
            this.icon = icon;
        }
    }
}
