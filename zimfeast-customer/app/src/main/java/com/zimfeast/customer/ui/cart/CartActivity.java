package com.zimfeast.customer.ui.cart;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;

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

public class CartActivity extends AppCompatActivity implements CartAdapter.OnCartItemListener {

    private ActivityCartBinding binding;
    private CartAdapter adapter;
    private List<CartItem> cartItems = new ArrayList<>();
    private String currency = "USD";
    private double deliveryFee = DeliveryUtils.DEFAULT_DELIVERY_FEE;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityCartBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        setupRecyclerView();
        setupClickListeners();
        observeCart();
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

    private void updateTotals() {
        double subtotal = 0;
        for (CartItem item : cartItems) {
            subtotal += item.getTotalPrice();
        }

        double total = subtotal + deliveryFee;

        binding.tvSubtotal.setText(DeliveryUtils.formatCurrency(subtotal, currency));
        binding.tvDeliveryFee.setText(DeliveryUtils.formatCurrency(deliveryFee, currency));
        binding.tvTotal.setText(DeliveryUtils.formatCurrency(total, currency));
    }

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
        Executors.newSingleThreadExecutor().execute(() -> {
            AppDatabase.getInstance(this).cartDao().delete(item);
        });
    }

    private void createOrder() {
        if (cartItems.isEmpty()) {
            Toast.makeText(this, "Your cart is empty", Toast.LENGTH_SHORT).show();
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
        orderData.put("deliveryAddress", "Current Location");
        orderData.put("currency", currency);
        orderData.put("status", "pending");

        ApiClient.getInstance().getApiService().createOrder(orderData).enqueue(new Callback<Order>() {
            @Override
            public void onResponse(Call<Order> call, Response<Order> response) {
                setLoading(false);

                if (response.isSuccessful() && response.body() != null) {
                    Order order = response.body();
                    Executors.newSingleThreadExecutor().execute(() -> {
                        AppDatabase.getInstance(CartActivity.this).cartDao().clearCart();
                    });

                    Intent intent = new Intent(CartActivity.this, CheckoutActivity.class);
                    intent.putExtra("orderId", order.getId());
                    startActivity(intent);
                    finish();
                } else {
                    Toast.makeText(CartActivity.this, getString(R.string.error_order), Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<Order> call, Throwable t) {
                setLoading(false);
                Toast.makeText(CartActivity.this, getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void setLoading(boolean loading) {
        binding.progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.btnCheckout.setEnabled(!loading);
    }
}
