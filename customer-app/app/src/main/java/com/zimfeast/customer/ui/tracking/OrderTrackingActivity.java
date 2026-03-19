package com.zimfeast.customer.ui.tracking;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.model.Order;
import com.zimfeast.customer.databinding.ActivityOrderTrackingBinding;
import com.zimfeast.customer.ui.customer.CustomerActivity;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class OrderTrackingActivity extends AppCompatActivity {

    private ActivityOrderTrackingBinding binding;
    private String orderId;
    private Order currentOrder;
    private Handler handler;
    private Runnable pollRunnable;
    private static final long POLL_INTERVAL_BASE = 15000;
    private static final long POLL_INTERVAL_MAX = 120000; // Cap at 2 minutes
    private long currentPollInterval = POLL_INTERVAL_BASE;
    private int consecutiveFailures = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityOrderTrackingBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        orderId = getIntent().getStringExtra("orderId");
        if (orderId == null) {
            Toast.makeText(this, "Order not found", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        handler = new Handler(Looper.getMainLooper());
        setupViews();
        loadOrderStatus();
        startPolling();
    }

    private void setupViews() {
        binding.btnBack.setOnClickListener(v -> {
            startActivity(new Intent(this, CustomerActivity.class));
            finishAffinity();
        });

        binding.btnCallDriver.setOnClickListener(v -> {
            if (currentOrder != null && currentOrder.getDriver() != null && currentOrder.getDriver().getPhone() != null) {
                Intent intent = new Intent(Intent.ACTION_DIAL);
                intent.setData(Uri.parse("tel:" + currentOrder.getDriver().getPhone()));
                startActivity(intent);
            }
        });
    }

    private void loadOrderStatus() {
        ApiClient.getInstance().getApiService().getOrderStatus(orderId).enqueue(new Callback<Order>() {
            @Override
            public void onResponse(Call<Order> call, Response<Order> response) {
                if (isFinishing() || isDestroyed()) return;
                if (response.isSuccessful() && response.body() != null) {
                    currentOrder = response.body();
                    updateUI();
                    // Reset backoff on success
                    consecutiveFailures = 0;
                    currentPollInterval = POLL_INTERVAL_BASE;
                    // Stop polling if order is in terminal state
                    String status = currentOrder.getStatus();
                    if ("delivered".equals(status) || "cancelled".equals(status) || "collected".equals(status)) {
                        stopPolling();
                    }
                }
            }

            @Override
            public void onFailure(Call<Order> call, Throwable t) {
                if (isFinishing() || isDestroyed()) return;
                // Exponential backoff with jitter on failure
                consecutiveFailures++;
                long backoff = Math.min(
                    POLL_INTERVAL_BASE * (1L << Math.min(consecutiveFailures, 6)),
                    POLL_INTERVAL_MAX
                );
                // Add random jitter (0-25% of interval)
                currentPollInterval = backoff + (long)(Math.random() * backoff * 0.25);
                displayMockStatus();
            }
        });
    }

    private void updateUI() {
        if (currentOrder == null) {
            displayMockStatus();
            return;
        }

        String status = currentOrder.getStatus();
        updateStatusTimeline(status);

        if (currentOrder.getDriver() != null) {
            binding.layoutDriver.setVisibility(View.VISIBLE);
            binding.tvDriverName.setText(currentOrder.getDriver().getName());
            binding.tvDriverVehicle.setText(currentOrder.getDriver().getVehicle());
        } else {
            binding.layoutDriver.setVisibility(View.GONE);
        }
    }

    private void displayMockStatus() {
        updateStatusTimeline("out_for_delivery");

        binding.layoutDriver.setVisibility(View.VISIBLE);
        binding.tvDriverName.setText("John Mukamuri");
        binding.tvDriverVehicle.setText("Toyota Vitz - ABC 123 GP");
    }

    private void updateStatusTimeline(String status) {
        int activeColor = getResources().getColor(R.color.primary, getTheme());
        int doneColor = getResources().getColor(R.color.success, getTheme());
        int inactiveColor = getResources().getColor(R.color.text_tertiary, getTheme());
        int lineInactive = getResources().getColor(R.color.divider, getTheme());

        // Step 1: Confirmed - always done
        binding.ivConfirmed.setImageResource(R.drawable.ic_check_circle);
        binding.ivConfirmed.setColorFilter(doneColor);
        binding.tvConfirmedTime.setText("2:30 PM");

        // Step 2: Preparing
        boolean preparingComplete = !"pending".equals(status) && !"confirmed".equals(status);
        binding.ivPreparing.setImageResource(preparingComplete ? R.drawable.ic_check_circle : R.drawable.ic_circle_outline);
        binding.ivPreparing.setColorFilter(preparingComplete ? doneColor : inactiveColor);
        binding.tvPreparingTime.setText(preparingComplete ? "2:35 PM" : "");
        binding.line1.setBackgroundColor(preparingComplete ? doneColor : lineInactive);

        // Step 3: Out for delivery
        boolean outForDeliveryComplete = "out_for_delivery".equals(status) || "delivered".equals(status);
        binding.ivOutForDelivery.setImageResource(outForDeliveryComplete ? R.drawable.ic_check_circle : R.drawable.ic_circle_outline);
        binding.ivOutForDelivery.setColorFilter(outForDeliveryComplete ? doneColor : inactiveColor);
        binding.tvOutForDeliveryTime.setText(outForDeliveryComplete ? "3:15 PM" : "");
        binding.line2.setBackgroundColor(outForDeliveryComplete ? doneColor : lineInactive);

        // Step 4: Delivered
        boolean deliveredComplete = "delivered".equals(status);
        binding.ivDelivered.setImageResource(deliveredComplete ? R.drawable.ic_check_circle : R.drawable.ic_circle_outline);
        binding.ivDelivered.setColorFilter(deliveredComplete ? doneColor : inactiveColor);
        binding.tvDeliveredTime.setText(deliveredComplete ? "3:30 PM" : getString(R.string.estimated) + " 3:30 PM");
        binding.line3.setBackgroundColor(deliveredComplete ? doneColor : lineInactive);
    }

    private void startPolling() {
        pollRunnable = new Runnable() {
            @Override
            public void run() {
                loadOrderStatus();
                // Use adaptive interval (backs off on failure, resets on success)
                handler.postDelayed(this, currentPollInterval);
            }
        };
        handler.postDelayed(pollRunnable, currentPollInterval);
    }

    private void stopPolling() {
        if (handler != null && pollRunnable != null) {
            handler.removeCallbacks(pollRunnable);
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopPolling();
    }
}
