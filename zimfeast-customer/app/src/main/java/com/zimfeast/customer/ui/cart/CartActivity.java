package com.zimfeast.customer.ui.cart;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.local.AppDatabase;
import com.zimfeast.customer.data.model.CartItem;
import com.zimfeast.customer.data.model.Order;
import com.zimfeast.customer.databinding.ActivityCartBinding;
import com.zimfeast.customer.ui.checkout.CheckoutActivity;
import com.zimfeast.customer.util.DeliveryUtils;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CartActivity extends AppCompatActivity
        implements CartAdapter.OnCartItemListener {

    private static final int LOCATION_PERMISSION_REQUEST = 1001;
    private static final int MAX_LOCATION_ATTEMPTS = 3;

    private ActivityCartBinding binding;
    private CartAdapter adapter;
    private List<CartItem> cartItems = new ArrayList<>();

    private String currency = "USD";
    private double deliveryFee = 0.0;

    private int locationAttempts = 0;
    private Double userLat = null;
    private Double userLng = null;

    private FusedLocationProviderClient fusedLocationClient;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityCartBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        setupRecyclerView();
        setupClickListeners();
        observeCart();
        requestUserLocation();
    }

    private void setupRecyclerView() {
        adapter = new CartAdapter(cartItems, this);
        binding.rvCartItems.setLayoutManager(new LinearLayoutManager(this));
        binding.rvCartItems.setAdapter(adapter);
    }

    private void setupClickListeners() {
        binding.btnBack.setOnClickListener(v -> finish());
        binding.btnCheckout.setOnClickListener(v -> createOrder());
    }

    private void observeCart() {
        AppDatabase.getInstance(this).cartDao().getAllItems().observe(this, items -> {
            cartItems = items != null ? items : new ArrayList<>();
            adapter.updateData(cartItems);

            if (cartItems.isEmpty()) {
                binding.layoutEmpty.setVisibility(View.VISIBLE);
                binding.layoutCart.setVisibility(View.GONE);
            } else {
                binding.layoutEmpty.setVisibility(View.GONE);
                binding.layoutCart.setVisibility(View.VISIBLE);
                updateTotals();
            }
        });
    }

    /* ===================== LOCATION ===================== */

    private void requestUserLocation() {
        if (ContextCompat.checkSelfPermission(
                this, Manifest.permission.ACCESS_FINE_LOCATION)
                == PackageManager.PERMISSION_GRANTED) {
            fetchUserLocation();
            return;
        }

        if (locationAttempts >= MAX_LOCATION_ATTEMPTS) {
            Toast.makeText(
                    this,
                    "Location permission is required to calculate delivery fee",
                    Toast.LENGTH_LONG
            ).show();
            binding.btnCheckout.setEnabled(false);
            return;
        }

        locationAttempts++;

        ActivityCompat.requestPermissions(
                this,
                new String[]{Manifest.permission.ACCESS_FINE_LOCATION},
                LOCATION_PERMISSION_REQUEST
        );
    }

    @Override
    public void onRequestPermissionsResult(
            int requestCode,
            @NonNull String[] permissions,
            @NonNull int[] grantResults) {

        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == LOCATION_PERMISSION_REQUEST) {
            if (grantResults.length > 0 &&
                    grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                fetchUserLocation();
            } else {
                requestUserLocation(); // retry up to 3 times
            }
        }
    }

    private void fetchUserLocation() {
        if (ActivityCompat.checkSelfPermission(
                this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        fusedLocationClient.getLastLocation()
                .addOnSuccessListener(location -> {
                    if (location != null) {
                        userLat = location.getLatitude();
                        userLng = location.getLongitude();
                        updateTotals();
                    } else {
                        Toast.makeText(
                                this,
                                "Unable to get your location",
                                Toast.LENGTH_SHORT
                        ).show();
                    }
                });
    }

    /* ===================== TOTALS ===================== */

    private void updateTotals() {
        if (cartItems.isEmpty() || userLat == null || userLng == null) {
            return;
        }

        double subtotal = 0;
        for (CartItem item : cartItems) {
            subtotal += item.getTotalPrice();
        }

        CartItem firstItem = cartItems.get(0);
        double restaurantLat = firstItem.getRestaurantLat();
        double restaurantLng = firstItem.getRestaurantLng();

        deliveryFee = DeliveryUtils.calculateDeliveryFee(
                userLat,
                userLng,
                restaurantLat,
                restaurantLng
        );

        double total = subtotal + deliveryFee;

        binding.tvSubtotal.setText(
                DeliveryUtils.formatCurrency(subtotal, currency));
        binding.tvDeliveryFee.setText(
                DeliveryUtils.formatCurrency(deliveryFee, currency));
        binding.tvTotal.setText(
                DeliveryUtils.formatCurrency(total, currency));
    }

    /* ===================== CART ACTIONS ===================== */

    @Override
    public void onQuantityChanged(CartItem item, int newQuantity) {
        Executors.newSingleThreadExecutor().execute(() -> {
            if (newQuantity <= 0) {
                AppDatabase.getInstance(this).cartDao().delete(item);
            } else {
                item.setQuantity(newQuantity);
                AppDatabase.getInstance(this).cartDao().update(item);
            }
        });
    }

    @Override
    public void onRemoveItem(CartItem item) {
        Executors.newSingleThreadExecutor().execute(() ->
                AppDatabase.getInstance(this).cartDao().delete(item));
    }

    /* ===================== ORDER ===================== */

    private void createOrder() {
        if (cartItems.isEmpty()) {
            Toast.makeText(this, "Your cart is empty", Toast.LENGTH_SHORT).show();
            return;
        }

        if (userLat == null || userLng == null) {
            Toast.makeText(
                    this,
                    "Please allow location access to continue",
                    Toast.LENGTH_SHORT
            ).show();
            return;
        }

        setLoading(true);

        String restaurantId = cartItems.get(0).getRestaurantId();

        double subtotal = 0;
        List<Map<String, Object>> itemsList = new ArrayList<>();

        for (CartItem item : cartItems) {
            subtotal += item.getTotalPrice();

            Map<String, Object> itemMap = new HashMap<>();
            itemMap.put("id", item.getId());
            itemMap.put("name", item.getName());
            itemMap.put("price", item.getPrice());
            itemMap.put("quantity", item.getQuantity());
            itemsList.add(itemMap);
        }

        Map<String, Object> orderData = new HashMap<>();
        orderData.put("restaurantId", restaurantId);
        orderData.put("items", itemsList);
        orderData.put("subtotal", String.format("%.2f", subtotal));
        orderData.put("deliveryFee", String.format("%.2f", deliveryFee));
        orderData.put("total", String.format("%.2f", subtotal + deliveryFee));
        orderData.put("deliveryAddress", "Current Location");
        orderData.put("currency", currency);
        orderData.put("status", "pending");

        ApiClient.getInstance().getApiService()
                .createOrder(orderData)
                .enqueue(new Callback<Order>() {
                    @Override
                    public void onResponse(
                            Call<Order> call,
                            Response<Order> response) {

                        setLoading(false);

                        if (response.isSuccessful() && response.body() != null) {
                            Executors.newSingleThreadExecutor().execute(() ->
                                    AppDatabase.getInstance(
                                                    CartActivity.this)
                                            .cartDao().clearCart());

                            Intent intent = new Intent(
                                    CartActivity.this,
                                    CheckoutActivity.class);
                            intent.putExtra(
                                    "orderId",
                                    response.body().getId());
                            startActivity(intent);
                            finish();
                        } else {
                            Toast.makeText(
                                    CartActivity.this,
                                    getString(R.string.error_order),
                                    Toast.LENGTH_SHORT
                            ).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<Order> call, Throwable t) {
                        setLoading(false);
                        Toast.makeText(
                                CartActivity.this,
                                getString(R.string.error_network),
                                Toast.LENGTH_SHORT
                        ).show();
                    }
                });
    }

    private void setLoading(boolean loading) {
        binding.progressBar.setVisibility(
                loading ? View.VISIBLE : View.GONE);
        binding.btnCheckout.setEnabled(!loading);
    }
}
