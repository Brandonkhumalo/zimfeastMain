package com.zimfeast.driver.ui;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.zimfeast.driver.R;
import com.zimfeast.driver.data.api.ApiClient;
import com.zimfeast.driver.data.api.ApiService;
import com.zimfeast.driver.data.model.StatusUpdateRequest;
import com.zimfeast.driver.socket.SocketManager;

import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class DeliveryActivity extends AppCompatActivity {

    private String orderId;
    private String restaurantName;
    private double restaurantLat;
    private double restaurantLng;
    private String dropoffAddress;
    private double dropoffLat;
    private double dropoffLng;

    private String currentStatus = "driver_assigned";
    private String customerName;
    private String customerPhone;
    private double deliveryFee;
    private double tip;

    private TextView tvStatus;
    private TextView tvRestaurant;
    private TextView tvDropoff;
    private TextView tvCustomerName;
    private TextView tvCustomerPhone;
    private TextView tvEarnings;
    private Button btnNavigate;
    private Button btnUpdateStatus;
    private Button btnCallCustomer;

    private SocketManager socketManager;
    private ApiService apiService;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_delivery);

        Intent intent = getIntent();
        orderId = intent.getStringExtra("orderId");
        restaurantName = intent.getStringExtra("restaurantName");
        restaurantLat = intent.getDoubleExtra("restaurantLat", 0);
        restaurantLng = intent.getDoubleExtra("restaurantLng", 0);
        dropoffAddress = intent.getStringExtra("dropoffAddress");
        dropoffLat = intent.getDoubleExtra("dropoffLat", 0);
        dropoffLng = intent.getDoubleExtra("dropoffLng", 0);
        customerName = intent.getStringExtra("customerName");
        customerPhone = intent.getStringExtra("customerPhone");
        deliveryFee = intent.getDoubleExtra("deliveryFee", 0);
        tip = intent.getDoubleExtra("tip", 0);

        socketManager = SocketManager.getInstance();
        apiService = ApiClient.getClient().create(ApiService.class);

        initViews();
        updateUI();
    }

    private void initViews() {
        tvStatus = findViewById(R.id.tv_delivery_status);
        tvRestaurant = findViewById(R.id.tv_restaurant);
        tvDropoff = findViewById(R.id.tv_dropoff);
        btnNavigate = findViewById(R.id.btn_navigate);
        btnUpdateStatus = findViewById(R.id.btn_update_status);

        tvRestaurant.setText(restaurantName);
        tvDropoff.setText(dropoffAddress);

        btnNavigate.setOnClickListener(v -> openNavigation());
        btnUpdateStatus.setOnClickListener(v -> advanceStatus());
    }

    private void updateUI() {
        switch (currentStatus) {
            case "driver_assigned":
                tvStatus.setText("Navigate to Restaurant");
                btnUpdateStatus.setText("Arrived at Restaurant");
                break;
            case "arrived_restaurant":
                tvStatus.setText("At Restaurant - Wait for pickup");
                btnUpdateStatus.setText("Picked Up Order");
                break;
            case "picked_up":
                tvStatus.setText("Order Picked Up - Heading to Customer");
                btnUpdateStatus.setText("Arrived at Destination");
                break;
            case "out_for_delivery":
                tvStatus.setText("On the Way to Customer");
                btnUpdateStatus.setText("Arrived at Destination");
                break;
            case "arrived_destination":
                tvStatus.setText("At Destination - Deliver to Customer");
                btnUpdateStatus.setText("Complete Delivery");
                break;
            case "delivered":
                tvStatus.setText("Delivery Complete!");
                btnUpdateStatus.setEnabled(false);
                btnUpdateStatus.setText("Done");

                Toast.makeText(this, "Delivery completed!", Toast.LENGTH_LONG).show();

                new android.os.Handler().postDelayed(() -> {
                    finish();
                }, 2000);
                break;
        }
    }

    private void advanceStatus() {
        String newStatus;
        switch (currentStatus) {
            case "driver_assigned":
                newStatus = "arrived_restaurant";
                break;
            case "arrived_restaurant":
                newStatus = "picked_up";
                break;
            case "picked_up":
                newStatus = "out_for_delivery";
                break;
            case "out_for_delivery":
                newStatus = "arrived_destination";
                break;
            case "arrived_destination":
                newStatus = "delivered";
                break;
            default:
                return;
        }

        btnUpdateStatus.setEnabled(false);
        final String statusToSet = newStatus;

        socketManager.updateDeliveryStatus(orderId, statusToSet);

        StatusUpdateRequest statusRequest = new StatusUpdateRequest(statusToSet);
        apiService.updateOrderStatus(orderId, statusRequest).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                runOnUiThread(() -> {
                    if (response.isSuccessful()) {
                        currentStatus = statusToSet;
                        updateUI();

                        String message = getStatusMessage(statusToSet);
                        Toast.makeText(DeliveryActivity.this, message, Toast.LENGTH_SHORT).show();
                    } else {
                        Toast.makeText(DeliveryActivity.this, "Failed to update status", Toast.LENGTH_SHORT).show();
                        btnUpdateStatus.setEnabled(true);
                    }
                });
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                runOnUiThread(() -> {
                    currentStatus = statusToSet;
                    updateUI();
                    Toast.makeText(DeliveryActivity.this, "Status updated locally", Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    private String getStatusMessage(String status) {
        switch (status) {
            case "arrived_restaurant":
                return "Arrived at restaurant";
            case "picked_up":
                return "Order picked up - heading to customer";
            case "out_for_delivery":
                return "On the way to customer";
            case "arrived_destination":
                return "Arrived at destination";
            case "delivered":
                return "Delivery completed!";
            default:
                return "Status updated";
        }
    }

    private void openNavigation() {
        double lat, lng;

        if (currentStatus.equals("driver_assigned") ||
                currentStatus.equals("arrived_restaurant")) {
            lat = restaurantLat;
            lng = restaurantLng;
        } else {
            lat = dropoffLat;
            lng = dropoffLng;
        }

        Uri gmmIntentUri = Uri.parse("google.navigation:q=" + lat + "," + lng);
        Intent mapIntent = new Intent(Intent.ACTION_VIEW, gmmIntentUri);
        mapIntent.setPackage("com.google.android.apps.maps");

        if (mapIntent.resolveActivity(getPackageManager()) != null) {
            startActivity(mapIntent);
        } else {
            Uri webUri = Uri.parse("https://www.google.com/maps/dir/?api=1&destination=" + lat + "," + lng);
            startActivity(new Intent(Intent.ACTION_VIEW, webUri));
        }
    }

    @Override
    public void onBackPressed() {
        if (!currentStatus.equals("delivered")) {
            Toast.makeText(this, "Please complete the delivery first", Toast.LENGTH_SHORT).show();
        } else {
            super.onBackPressed();
        }
    }
}
