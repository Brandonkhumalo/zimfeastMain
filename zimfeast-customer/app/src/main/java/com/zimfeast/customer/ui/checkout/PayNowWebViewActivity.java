package com.zimfeast.customer.ui.checkout;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.model.Order;
import com.zimfeast.customer.databinding.ActivityPaynowWebviewBinding;
import com.zimfeast.customer.ui.tracking.OrderTrackingActivity;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class PayNowWebViewActivity extends AppCompatActivity {

    private ActivityPaynowWebviewBinding binding;
    private String orderId;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityPaynowWebviewBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        String url = getIntent().getStringExtra("url");
        orderId = getIntent().getStringExtra("orderId");

        if (url == null) {
            finish();
            return;
        }

        setupWebView();
        binding.webView.loadUrl(url);

        binding.btnClose.setOnClickListener(v -> {
            verifyPaymentAndNavigate();
        });
    }

    private void setupWebView() {
        WebSettings settings = binding.webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);

        binding.webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();

                if (url.contains("success") || url.contains("complete")) {
                    verifyPaymentAndNavigate();
                    return true;
                }

                if (url.contains("cancel") || url.contains("fail")) {
                    showPaymentCancelledDialog();
                    return true;
                }

                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                binding.progressBar.setVisibility(View.GONE);
            }
        });
    }

    private void verifyPaymentAndNavigate() {
        binding.progressBar.setVisibility(View.VISIBLE);
        binding.btnClose.setEnabled(false);

        ApiClient.getInstance().getApiService().getOrder(orderId).enqueue(new Callback<Order>() {
            @Override
            public void onResponse(Call<Order> call, Response<Order> response) {
                binding.progressBar.setVisibility(View.GONE);
                binding.btnClose.setEnabled(true);

                if (response.isSuccessful() && response.body() != null) {
                    Order order = response.body();
                    String status = order.getStatus();

                    if (isPaid(status)) {
                        navigateToTracking();
                    } else {
                        showPaymentPendingDialog();
                    }
                } else {
                    Toast.makeText(PayNowWebViewActivity.this, 
                            "Could not verify payment. Please try again.", 
                            Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<Order> call, Throwable t) {
                binding.progressBar.setVisibility(View.GONE);
                binding.btnClose.setEnabled(true);
                Toast.makeText(PayNowWebViewActivity.this, 
                        "Network error. Please check your connection.", 
                        Toast.LENGTH_SHORT).show();
            }
        });
    }

    private boolean isPaid(String status) {
        return status != null && !status.equals("pending_payment") && !status.equals("pending");
    }

    private void showPaymentPendingDialog() {
        new AlertDialog.Builder(this)
                .setTitle("Payment Not Completed")
                .setMessage("Your payment has not been confirmed yet. Please complete the payment or try again.")
                .setPositiveButton("Continue Payment", (dialog, which) -> {
                    dialog.dismiss();
                })
                .setNegativeButton("Cancel Order", (dialog, which) -> {
                    dialog.dismiss();
                    finish();
                })
                .setCancelable(false)
                .show();
    }

    private void showPaymentCancelledDialog() {
        new AlertDialog.Builder(this)
                .setTitle("Payment Cancelled")
                .setMessage("Your payment was cancelled. Would you like to try again?")
                .setPositiveButton("Try Again", (dialog, which) -> {
                    binding.webView.reload();
                })
                .setNegativeButton("Cancel", (dialog, which) -> {
                    finish();
                })
                .setCancelable(false)
                .show();
    }

    private void navigateToTracking() {
        Toast.makeText(this, "Payment confirmed!", Toast.LENGTH_SHORT).show();
        Intent intent = new Intent(this, OrderTrackingActivity.class);
        intent.putExtra("orderId", orderId);
        startActivity(intent);
        finish();
    }

    @Override
    public void onBackPressed() {
        if (binding.webView.canGoBack()) {
            binding.webView.goBack();
        } else {
            verifyPaymentAndNavigate();
        }
    }
}
