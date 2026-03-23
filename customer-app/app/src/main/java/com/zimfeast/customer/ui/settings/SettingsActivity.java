package com.zimfeast.customer.ui.settings;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.google.android.material.switchmaterial.SwitchMaterial;
import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.util.BiometricHelper;
import com.zimfeast.customer.util.TokenManager;

public class SettingsActivity extends AppCompatActivity {

    private TokenManager tokenManager;
    private SwitchMaterial switchBiometric;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        tokenManager = ApiClient.getInstance().getTokenManager();

        switchBiometric = findViewById(R.id.switch_biometric);

        // Set initial state
        boolean canUseBio = BiometricHelper.canUseBiometrics(this);
        switchBiometric.setEnabled(canUseBio);
        switchBiometric.setChecked(tokenManager.isBiometricEnabled());

        if (!canUseBio) {
            switchBiometric.setText("Biometric Login (not available on this device)");
        }

        // WhatsApp Support card — opens WhatsApp chat with ZimFeast support
        findViewById(R.id.card_whatsapp_support).setOnClickListener(v -> openWhatsAppSupport());

        switchBiometric.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (isChecked) {
                // Verify biometric first before enabling
                BiometricHelper.showBiometricPrompt(this, new BiometricHelper.AuthCallback() {
                    @Override
                    public void onSuccess() {
                        tokenManager.setBiometricEnabled(true);
                        Toast.makeText(SettingsActivity.this,
                                "Biometric login enabled", Toast.LENGTH_SHORT).show();
                    }

                    @Override
                    public void onFailure(String error) {
                        switchBiometric.setChecked(false);
                        Toast.makeText(SettingsActivity.this,
                                "Biometric verification failed", Toast.LENGTH_SHORT).show();
                    }
                });
            } else {
                tokenManager.setBiometricEnabled(false);
                Toast.makeText(this, "Biometric login disabled", Toast.LENGTH_SHORT).show();
            }
        });
    }

    /**
     * Opens WhatsApp chat with ZimFeast support number.
     * Uses the wa.me deep link which works whether WhatsApp is installed or not —
     * if WhatsApp is installed it opens directly, otherwise it falls back to the browser.
     */
    private void openWhatsAppSupport() {
        String url = "https://wa.me/263781603382?text=" + Uri.encode("Hi ZimFeast, I need help with...");
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        try {
            startActivity(intent);
        } catch (Exception e) {
            // Fallback: open in browser if no app can handle the intent
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            browserIntent.setPackage(null);
            startActivity(browserIntent);
        }
    }
}
