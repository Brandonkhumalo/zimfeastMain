package com.zimfeast.customer.util;

import android.content.Context;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

/**
 * Helper class for biometric authentication (fingerprint/face).
 *
 * Usage:
 *   if (BiometricHelper.canUseBiometrics(context)) {
 *       BiometricHelper.showBiometricPrompt(activity, new BiometricHelper.AuthCallback() {
 *           public void onSuccess() { ... }
 *           public void onFailure(String error) { ... }
 *       });
 *   }
 */
public class BiometricHelper {

    public interface AuthCallback {
        void onSuccess();
        void onFailure(String error);
    }

    /**
     * Check if the device supports biometric authentication.
     */
    public static boolean canUseBiometrics(@NonNull Context context) {
        BiometricManager biometricManager = BiometricManager.from(context);
        return biometricManager.canAuthenticate(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                == BiometricManager.BIOMETRIC_SUCCESS;
    }

    /**
     * Show the biometric prompt to the user.
     */
    public static void showBiometricPrompt(
            @NonNull FragmentActivity activity,
            @NonNull AuthCallback callback
    ) {
        BiometricPrompt.PromptInfo promptInfo = new BiometricPrompt.PromptInfo.Builder()
                .setTitle("Biometric Login")
                .setSubtitle("Use your fingerprint or face to sign in")
                .setNegativeButtonText("Use Password")
                .setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_STRONG)
                .build();

        BiometricPrompt biometricPrompt = new BiometricPrompt(activity,
                ContextCompat.getMainExecutor(activity),
                new BiometricPrompt.AuthenticationCallback() {
                    @Override
                    public void onAuthenticationSucceeded(
                            @NonNull BiometricPrompt.AuthenticationResult result) {
                        super.onAuthenticationSucceeded(result);
                        callback.onSuccess();
                    }

                    @Override
                    public void onAuthenticationError(int errorCode, @NonNull CharSequence errString) {
                        super.onAuthenticationError(errorCode, errString);
                        callback.onFailure(errString.toString());
                    }

                    @Override
                    public void onAuthenticationFailed() {
                        super.onAuthenticationFailed();
                        // Don't call onFailure here - the system will show retry
                    }
                });

        biometricPrompt.authenticate(promptInfo);
    }
}
