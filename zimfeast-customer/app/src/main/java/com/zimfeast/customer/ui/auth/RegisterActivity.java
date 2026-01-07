package com.zimfeast.customer.ui.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.model.AuthResponse;
import com.zimfeast.customer.databinding.ActivityRegisterBinding;
import com.zimfeast.customer.ui.customer.CustomerActivity;
import com.zimfeast.customer.util.TokenManager;

import java.util.HashMap;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class RegisterActivity extends AppCompatActivity {

    private ActivityRegisterBinding binding;
    private TokenManager tokenManager;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityRegisterBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        tokenManager = ApiClient.getInstance().getTokenManager();

        setupRoleSpinner();
        setupClickListeners();
    }

    private void setupRoleSpinner() {
        String[] roles = {getString(R.string.customer), getString(R.string.restaurant), getString(R.string.driver)};
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, roles);
        binding.spinnerRole.setAdapter(adapter);
    }

    private void setupClickListeners() {
        binding.btnRegister.setOnClickListener(v -> attemptRegister());

        binding.tvLogin.setOnClickListener(v -> finish());
    }

    private void attemptRegister() {
        String firstName = binding.etFirstName.getText().toString().trim();
        String lastName = binding.etLastName.getText().toString().trim();
        String email = binding.etEmail.getText().toString().trim();
        String phone = binding.etPhone.getText().toString().trim();
        String password = binding.etPassword.getText().toString().trim();
        String role = getRoleValue(binding.spinnerRole.getSelectedItemPosition());

        if (firstName.isEmpty() || lastName.isEmpty() || email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Please fill in all required fields", Toast.LENGTH_SHORT).show();
            return;
        }

        setLoading(true);

        Map<String, String> userData = new HashMap<>();
        userData.put("first_name", firstName);
        userData.put("last_name", lastName);
        userData.put("email", email);
        userData.put("phone_number", phone);
        userData.put("password", password);
        userData.put("role", role);

        ApiClient.getInstance().getApiService().register(userData).enqueue(new Callback<AuthResponse>() {
            @Override
            public void onResponse(Call<AuthResponse> call, Response<AuthResponse> response) {
                setLoading(false);

                if (response.isSuccessful() && response.body() != null) {
                    AuthResponse authResponse = response.body();
                    tokenManager.saveToken(authResponse.getAccessToken());
                    if (authResponse.getRefreshToken() != null) {
                        tokenManager.saveRefreshToken(authResponse.getRefreshToken());
                    }
                    if (authResponse.getUser() != null) {
                        tokenManager.saveUserRole(authResponse.getUser().getRole());
                        tokenManager.saveUserId(authResponse.getUser().getId());
                    }

                    Toast.makeText(RegisterActivity.this, "Registration successful!", Toast.LENGTH_SHORT).show();
                    startActivity(new Intent(RegisterActivity.this, CustomerActivity.class));
                    finishAffinity();
                } else {
                    Toast.makeText(RegisterActivity.this, getString(R.string.error_register), Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<AuthResponse> call, Throwable t) {
                setLoading(false);
                Toast.makeText(RegisterActivity.this, getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private String getRoleValue(int position) {
        switch (position) {
            case 1: return "restaurant";
            case 2: return "driver";
            default: return "customer";
        }
    }

    private void setLoading(boolean loading) {
        binding.progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.btnRegister.setEnabled(!loading);
        binding.btnRegister.setText(loading ? getString(R.string.processing) : getString(R.string.register));
    }
}
