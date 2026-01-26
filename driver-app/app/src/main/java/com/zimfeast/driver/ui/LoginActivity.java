package com.zimfeast.driver.ui;

import android.content.Intent;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.zimfeast.driver.R;
import com.zimfeast.driver.ZimFeastDriverApp;
import com.zimfeast.driver.data.api.ApiClient;
import com.zimfeast.driver.data.api.ApiService;
import com.zimfeast.driver.data.model.LoginRequest;
import com.zimfeast.driver.data.model.LoginResponse;
import com.zimfeast.driver.data.model.ProfileResponse;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class LoginActivity extends AppCompatActivity {
    
    private EditText etEmail;
    private EditText etPassword;
    private Button btnLogin;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);
        
        etEmail = findViewById(R.id.et_email);
        etPassword = findViewById(R.id.et_password);
        btnLogin = findViewById(R.id.btn_login);
        
        btnLogin.setOnClickListener(v -> attemptLogin());
    }
    
    private void attemptLogin() {
        String email = etEmail.getText().toString().trim();
        String password = etPassword.getText().toString().trim();
        
        if (email.isEmpty() || password.isEmpty()) {
            Toast.makeText(this, "Please fill in all fields", Toast.LENGTH_SHORT).show();
            return;
        }
        
        btnLogin.setEnabled(false);
        btnLogin.setText("Logging in...");
        
        ApiService api = ApiClient.getClient().create(ApiService.class);
        Call<LoginResponse> call = api.login(new LoginRequest(email, password));
        
        call.enqueue(new Callback<LoginResponse>() {
            @Override
            public void onResponse(Call<LoginResponse> call, Response<LoginResponse> response) {
                if (response.isSuccessful() && response.body() != null) {
                    LoginResponse data = response.body();
                    
                    if (!"driver".equals(data.getRole())) {
                        btnLogin.setEnabled(true);
                        btnLogin.setText("Login");
                        Toast.makeText(LoginActivity.this, 
                            "This app is for drivers only", Toast.LENGTH_LONG).show();
                        return;
                    }
                    
                    ZimFeastDriverApp app = ZimFeastDriverApp.getInstance();
                    app.saveAuthToken(data.getToken());
                    app.saveRefreshToken(data.getRefreshToken());
                    
                    fetchProfile(api);
                } else {
                    btnLogin.setEnabled(true);
                    btnLogin.setText("Login");
                    Toast.makeText(LoginActivity.this, 
                        "Invalid credentials", Toast.LENGTH_SHORT).show();
                }
            }
            
            @Override
            public void onFailure(Call<LoginResponse> call, Throwable t) {
                btnLogin.setEnabled(true);
                btnLogin.setText("Login");
                Toast.makeText(LoginActivity.this, 
                    "Connection error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
            }
        });
    }
    
    private void fetchProfile(ApiService api) {
        Call<ProfileResponse> profileCall = api.getProfile();
        profileCall.enqueue(new Callback<ProfileResponse>() {
            @Override
            public void onResponse(Call<ProfileResponse> call, Response<ProfileResponse> response) {
                btnLogin.setEnabled(true);
                btnLogin.setText("Login");
                
                ZimFeastDriverApp app = ZimFeastDriverApp.getInstance();
                
                if (response.isSuccessful() && response.body() != null) {
                    ProfileResponse profile = response.body();
                    app.saveDriverInfo(
                        profile.getId() != null ? profile.getId() : "",
                        profile.getFullName(),
                        profile.getPhoneNumber() != null ? profile.getPhoneNumber() : "",
                        "Car"
                    );
                } else {
                    app.saveDriverInfo("", "Driver", "", "Car");
                }
                
                startActivity(new Intent(LoginActivity.this, MainActivity.class));
                finish();
            }
            
            @Override
            public void onFailure(Call<ProfileResponse> call, Throwable t) {
                btnLogin.setEnabled(true);
                btnLogin.setText("Login");
                
                ZimFeastDriverApp app = ZimFeastDriverApp.getInstance();
                app.saveDriverInfo("", "Driver", "", "Car");
                
                startActivity(new Intent(LoginActivity.this, MainActivity.class));
                finish();
            }
        });
    }
}
