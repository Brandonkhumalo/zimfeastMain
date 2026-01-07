package com.zimfeast.customer.ui.checkout;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.appcompat.app.AppCompatActivity;

import com.zimfeast.customer.databinding.ActivityPaynowWebviewBinding;
import com.zimfeast.customer.ui.tracking.OrderTrackingActivity;

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
            navigateToTracking();
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
                    navigateToTracking();
                    return true;
                }

                if (url.contains("cancel") || url.contains("fail")) {
                    finish();
                    return true;
                }

                return false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                binding.progressBar.setVisibility(android.view.View.GONE);
            }
        });
    }

    private void navigateToTracking() {
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
            super.onBackPressed();
        }
    }
}
