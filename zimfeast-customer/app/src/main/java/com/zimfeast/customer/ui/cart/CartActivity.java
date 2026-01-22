package com.zimfeast.customer.ui.cart;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Bundle;
import android.util.Log;
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
import com.zimfeast.customer.data.model.CreateOrderResponse;
import com.zimfeast.customer.data.model.Order;
import com.zimfeast.customer.databinding.ActivityCartBinding;
import com.zimfeast.customer.ui.address.AddressPickerActivity;
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
    private static final int ADDRESS_PICKER_REQUEST = 1002;
    private static final int MAX_LOCATION_ATTEMPTS = 3;

    private ActivityCartBinding binding;
    private CartAdapter adapter;
    private List<CartItem> cartItems = new ArrayList<>();

    private String currency = "USD";
    private double deliveryFee = 0.0;
    private boolean isDelivery = true;
    private double tipAmount = 0.0;

    private int locationAttempts = 0;
    private Double userLat = null;
    private Double userLng = null;
    private String selectedAddress = null;

    private FusedLocationProviderClient fusedLocationClient;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityCartBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        setupRecyclerView();
        setupClickListeners();
        setupOrderTypeToggle();
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
        
        binding.layoutAddressPicker.setOnClickListener(v -> openAddressPicker());
    }
    
    private void openAddressPicker() {
        Intent intent = new Intent(this, AddressPickerActivity.class);
        startActivityForResult(intent, ADDRESS_PICKER_REQUEST);
    }
    
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == ADDRESS_PICKER_REQUEST && resultCode == RESULT_OK && data != null) {
            double lat = data.getDoubleExtra(AddressPickerActivity.EXTRA_LATITUDE, 0);
            double lng = data.getDoubleExtra(AddressPickerActivity.EXTRA_LONGITUDE, 0);
            String address = data.getStringExtra(AddressPickerActivity.EXTRA_ADDRESS);
            
            if (lat != 0 && lng != 0) {
                userLat = lat;
                userLng = lng;
                selectedAddress = address;
                
                binding.tvSelectedAddress.setText(address != null && !address.isEmpty() 
                        ? address 
                        : String.format("%.4f, %.4f", lat, lng));
                binding.etAddress.setText(selectedAddress);
                
                updateTotals();
            }
        }
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
        if (cartItems.isEmpty()) return;

        double subtotal = 0;
        for (CartItem item : cartItems) {
            subtotal += item.getTotalPrice();
        }

        double total = subtotal;

        //Declare once, usable everywhere below
        CartItem firstItem = cartItems.get(0);

        if (isDelivery) {
            if (userLat == null || userLng == null) return;

            Double restLat = firstItem.getRestaurantLat();
            Double restLng = firstItem.getRestaurantLng();
            
            if (restLat != null && restLng != null && restLat != 0 && restLng != 0) {
                deliveryFee = DeliveryUtils.calculateDeliveryFee(
                        userLat,
                        userLng,
                        restLat,
                        restLng
                );
            } else {
                deliveryFee = DeliveryUtils.DEFAULT_DELIVERY_FEE;
                android.util.Log.w("CartActivity", "Restaurant coordinates missing, using default fee");
            }

            total += deliveryFee + tipAmount;
            binding.tvDeliveryFee.setText(
                    DeliveryUtils.formatCurrency(deliveryFee, currency)
            );
        } else {
            binding.tvDeliveryFee.setText(
                    DeliveryUtils.formatCurrency(0, currency)
            );
        }

        binding.tvSubtotal.setText(
                DeliveryUtils.formatCurrency(subtotal, currency));
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

    private void setupOrderTypeToggle() {
        binding.rgOrderType.setOnCheckedChangeListener((group, checkedId) -> {
            if (checkedId == R.id.rb_delivery) {
                isDelivery = true;
                binding.layoutDeliveryOptions.setVisibility(View.VISIBLE);
                requestUserLocation();
            } else {
                isDelivery = false;
                binding.layoutDeliveryOptions.setVisibility(View.GONE);
                userLat = null;
                userLng = null;
                deliveryFee = 0.0;
                updateTotals();
            }
        });

        binding.etTip.addTextChangedListener(new android.text.TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
                // no-op
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                try {
                    tipAmount = s.length() == 0 ? 0.0 : Double.parseDouble(s.toString());
                } catch (NumberFormatException e) {
                    tipAmount = 0.0;
                }
                updateTotals();
            }

            @Override
            public void afterTextChanged(android.text.Editable s) {
                // no-op
            }
        });
    }

    private void createOrder() {
        if (cartItems.isEmpty()) {
            Toast.makeText(this, "Your cart is empty", Toast.LENGTH_SHORT).show();
            return;
        }

        //Location required ONLY for delivery
        if (isDelivery && (userLat == null || userLng == null)) {
            Toast.makeText(
                    this,
                    "Please allow location access to continue",
                    Toast.LENGTH_SHORT
            ).show();
            requestUserLocation(); // 🔥 trigger permission popup
            return;
        }

        setLoading(true);

        String restaurantId = cartItems.get(0).getRestaurantId();

        double subtotal = 0;
        List<Map<String, Object>> itemsList = new ArrayList<>();

        for (CartItem item : cartItems) {
            subtotal += item.getTotalPrice();

            Map<String, Object> itemMap = new HashMap<>();
            itemMap.put("menu_item_id", item.getId());
            itemMap.put("quantity", item.getQuantity());
            itemsList.add(itemMap);
        }

        Map<String, Object> orderData = new HashMap<>();
        double total = isDelivery
                ? subtotal + deliveryFee + tipAmount
                : subtotal;

        orderData.put("total_fee", String.format(java.util.Locale.US, "%.2f", total));
        orderData.put("restaurant", restaurantId);
        orderData.put("items", itemsList);
        orderData.put("method", isDelivery ? "delivery" : "collection");
        orderData.put("tip", String.format(java.util.Locale.US, "%.2f", tipAmount));
        
        if (isDelivery) {
            String address = selectedAddress != null && !selectedAddress.isEmpty() 
                    ? selectedAddress 
                    : binding.etAddress.getText().toString();
            orderData.put("delivery_address", address);
            orderData.put("delivery_lat", userLat);
            orderData.put("delivery_lng", userLng);
        }

        ApiClient.getInstance().getApiService()
                .createOrder(orderData)
                .enqueue(new Callback<CreateOrderResponse>() {
                    @Override
                    public void onResponse(
                            Call<CreateOrderResponse> call,
                            Response<CreateOrderResponse> response) {

                        setLoading(false);

                        if (response.isSuccessful() && response.body() != null 
                                && response.body().getOrder() != null) {
                            Executors.newSingleThreadExecutor().execute(() ->
                                    AppDatabase.getInstance(
                                                    CartActivity.this)
                                            .cartDao().clearCart());

                            Intent intent = new Intent(
                                    CartActivity.this,
                                    CheckoutActivity.class);
                            intent.putExtra(
                                    "orderId",
                                    response.body().getOrder().getId());
                            startActivity(intent);
                            finish();
                        } else {
                            String errorMsg = getString(R.string.error_order);
                            try {
                                if (response.errorBody() != null) {
                                    String errorBody = response.errorBody().string();
                                    Log.e("CartActivity", "Order creation failed: " + errorBody);
                                }
                            } catch (Exception e) {
                                Log.e("CartActivity", "Error reading error body", e);
                            }
                            Toast.makeText(
                                    CartActivity.this,
                                    errorMsg,
                                    Toast.LENGTH_SHORT
                            ).show();
                        }
                    }

                    @Override
                    public void onFailure(Call<CreateOrderResponse> call, Throwable t) {
                        setLoading(false);
                        Log.e("CartActivity", "Order creation network error", t);
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
