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
    private static final long POLL_INTERVAL = 15000;

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
                if (response.isSuccessful() && response.body() != null) {
                    currentOrder = response.body();
                    updateUI();
                }
            }

            @Override
            public void onFailure(Call<Order> call, Throwable t) {
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
        binding.ivConfirmed.setImageResource(R.drawable.ic_check_circle);
        binding.tvConfirmedTime.setText("2:30 PM");

        boolean preparingComplete = !"pending".equals(status) && !"confirmed".equals(status);
        binding.ivPreparing.setImageResource(preparingComplete ? R.drawable.ic_check_circle : R.drawable.ic_circle_outline);
        binding.tvPreparingTime.setText(preparingComplete ? "2:35 PM" : "");

        boolean outForDeliveryComplete = "out_for_delivery".equals(status) || "delivered".equals(status);
        binding.ivOutForDelivery.setImageResource(outForDeliveryComplete ? R.drawable.ic_check_circle : R.drawable.ic_circle_outline);
        binding.tvOutForDeliveryTime.setText(outForDeliveryComplete ? "3:15 PM" : "");

        boolean deliveredComplete = "delivered".equals(status);
        binding.ivDelivered.setImageResource(deliveredComplete ? R.drawable.ic_check_circle : R.drawable.ic_circle_outline);
        binding.tvDeliveredTime.setText(deliveredComplete ? "3:30 PM" : getString(R.string.estimated) + " 3:30 PM");
    }

    private void startPolling() {
        pollRunnable = new Runnable() {
            @Override
            public void run() {
                loadOrderStatus();
                handler.postDelayed(this, POLL_INTERVAL);
            }
        };
        handler.postDelayed(pollRunnable, POLL_INTERVAL);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (handler != null && pollRunnable != null) {
            handler.removeCallbacks(pollRunnable);
        }
    }
}
