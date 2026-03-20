package com.zimfeast.customer.ui.referral;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.model.ReferralCodeResponse;
import com.zimfeast.customer.data.model.ReferralCreditsResponse;
import com.zimfeast.customer.databinding.ActivityReferralBinding;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Activity that displays the user's referral code with copy/share buttons
 * and a summary of earned/used/available referral credits.
 */
public class ReferralActivity extends AppCompatActivity {

    private ActivityReferralBinding binding;
    private String referralCode = "";
    private String shareLink = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityReferralBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        binding.btnBack.setOnClickListener(v -> finish());
        binding.btnCopy.setOnClickListener(v -> copyCode());
        binding.btnShare.setOnClickListener(v -> shareCode());

        loadReferralCode();
        loadReferralCredits();
    }

    private void loadReferralCode() {
        ApiClient.getInstance().getApiService().getReferralCode().enqueue(new Callback<ReferralCodeResponse>() {
            @Override
            public void onResponse(Call<ReferralCodeResponse> call, Response<ReferralCodeResponse> response) {
                if (isFinishing() || isDestroyed()) return;
                if (response.isSuccessful() && response.body() != null) {
                    referralCode = response.body().getCode();
                    shareLink = response.body().getShareLink();
                    binding.tvReferralCode.setText(referralCode);
                    binding.tvShareLink.setText("Share link: " + shareLink);
                } else {
                    binding.tvReferralCode.setText("Error");
                }
            }

            @Override
            public void onFailure(Call<ReferralCodeResponse> call, Throwable t) {
                if (isFinishing() || isDestroyed()) return;
                binding.tvReferralCode.setText("Error loading code");
            }
        });
    }

    private void loadReferralCredits() {
        ApiClient.getInstance().getApiService().getReferralCredits().enqueue(new Callback<ReferralCreditsResponse>() {
            @Override
            public void onResponse(Call<ReferralCreditsResponse> call, Response<ReferralCreditsResponse> response) {
                if (isFinishing() || isDestroyed()) return;
                if (response.isSuccessful() && response.body() != null) {
                    ReferralCreditsResponse credits = response.body();
                    binding.tvAvailableCredits.setText(String.valueOf(credits.getAvailableCredits()));
                    binding.tvUsedCredits.setText(String.valueOf(credits.getUsedCredits()));
                    binding.tvTotalCredits.setText(String.valueOf(credits.getTotalCredits()));
                }
            }

            @Override
            public void onFailure(Call<ReferralCreditsResponse> call, Throwable t) {
                // Silently fail -- credits will show 0
            }
        });
    }

    private void copyCode() {
        if (referralCode.isEmpty()) return;

        ClipboardManager clipboard = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
        if (clipboard != null) {
            ClipData clip = ClipData.newPlainText("ZimFeast Referral Code", referralCode);
            clipboard.setPrimaryClip(clip);
            Toast.makeText(this, "Referral code copied!", Toast.LENGTH_SHORT).show();
        }
    }

    private void shareCode() {
        if (referralCode.isEmpty()) return;

        String shareText = "Join ZimFeast and use my referral code " + referralCode
                + " to sign up! After your first $20+ order, I get a 15% discount credit.\n"
                + shareLink;

        Intent shareIntent = new Intent(Intent.ACTION_SEND);
        shareIntent.setType("text/plain");
        shareIntent.putExtra(Intent.EXTRA_TEXT, shareText);
        shareIntent.putExtra(Intent.EXTRA_SUBJECT, "Join ZimFeast!");
        startActivity(Intent.createChooser(shareIntent, "Share via"));
    }
}
