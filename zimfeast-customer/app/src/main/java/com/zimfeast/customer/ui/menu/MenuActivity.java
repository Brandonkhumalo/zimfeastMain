package com.zimfeast.customer.ui.menu;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.bumptech.glide.Glide;
import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.local.AppDatabase;
import com.zimfeast.customer.data.model.CartItem;
import com.zimfeast.customer.data.model.MenuItem;
import com.zimfeast.customer.data.model.Restaurant;
import com.zimfeast.customer.databinding.ActivityMenuBinding;
import com.zimfeast.customer.ui.cart.CartActivity;
import com.zimfeast.customer.util.DeliveryUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executors;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class MenuActivity extends AppCompatActivity implements MenuAdapter.OnMenuItemClickListener {

    private ActivityMenuBinding binding;
    private MenuAdapter menuAdapter;
    private String restaurantId;
    private String restaurantName;
    private String restaurantImage;
    private String restaurantCuisine;
    private double restaurantRating;
    private int deliveryTime;
    private double restaurantLat;
    private double restaurantLng;
    private String currency = "USD";
    private int cartItemCount = 0;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityMenuBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        restaurantId = getIntent().getStringExtra("restaurantId");
        restaurantName = getIntent().getStringExtra("restaurantName");
        restaurantImage = getIntent().getStringExtra("restaurantImage");
        restaurantCuisine = getIntent().getStringExtra("restaurantCuisine");
        restaurantRating = getIntent().getDoubleExtra("restaurantRating", 4.5);
        deliveryTime = getIntent().getIntExtra("deliveryTime", 30);
        restaurantLat = getIntent().getDoubleExtra("restaurantLat", 0);
        restaurantLng = getIntent().getDoubleExtra("restaurantLng", 0);
        currency = getIntent().getStringExtra("currency");
        if (currency == null) currency = "USD";

        if (restaurantId == null) {
            Toast.makeText(this, "Restaurant not found", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        setupViews();
        displayRestaurantInfo();
        loadMenuItems();
        observeCart();
    }

    private void setupViews() {
        binding.btnBack.setOnClickListener(v -> finish());

        menuAdapter = new MenuAdapter(new ArrayList<>(), currency, this);
        binding.rvMenuItems.setLayoutManager(new LinearLayoutManager(this));
        binding.rvMenuItems.setAdapter(menuAdapter);

        binding.fabCart.setOnClickListener(v -> {
            startActivity(new Intent(this, CartActivity.class));
        });
    }

    private void displayRestaurantInfo() {
        binding.tvTitle.setText(restaurantName != null ? restaurantName : "Menu");
        binding.tvRestaurantName.setText(restaurantName != null ? restaurantName : "Restaurant");
        binding.tvRestaurantCuisine.setText(restaurantCuisine != null ? restaurantCuisine : "");
        binding.tvRating.setText(String.format("%.1f", restaurantRating));
        binding.tvDeliveryTime.setText(deliveryTime + "-" + (deliveryTime + 10) + " min");

        if (restaurantImage != null && !restaurantImage.isEmpty()) {
            Glide.with(this)
                    .load(restaurantImage)
                    .placeholder(R.drawable.placeholder_restaurant)
                    .error(R.drawable.placeholder_restaurant)
                    .centerCrop()
                    .into(binding.ivRestaurantImage);
        }
    }

    private void loadMenuItems() {
        setLoading(true);

        ApiClient.getInstance().getApiService().getRestaurantMenu(restaurantId).enqueue(new Callback<List<MenuItem>>() {
            @Override
            public void onResponse(Call<List<MenuItem>> call, Response<List<MenuItem>> response) {
                setLoading(false);

                if (response.isSuccessful() && response.body() != null) {
                    List<MenuItem> items = response.body();
                    if (items.isEmpty()) {
                        binding.tvEmpty.setVisibility(View.VISIBLE);
                        binding.rvMenuItems.setVisibility(View.GONE);
                    } else {
                        binding.tvEmpty.setVisibility(View.GONE);
                        binding.rvMenuItems.setVisibility(View.VISIBLE);
                        menuAdapter.updateData(items);
                    }
                } else {
                    Toast.makeText(MenuActivity.this, "Failed to load menu", Toast.LENGTH_SHORT).show();
                    binding.tvEmpty.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onFailure(Call<List<MenuItem>> call, Throwable t) {
                setLoading(false);
                Toast.makeText(MenuActivity.this, getString(R.string.error_network), Toast.LENGTH_SHORT).show();
                binding.tvEmpty.setVisibility(View.VISIBLE);
            }
        });
    }

    private void setLoading(boolean loading) {
        binding.progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.rvMenuItems.setVisibility(loading ? View.GONE : View.VISIBLE);
    }

    private void observeCart() {
        AppDatabase db = AppDatabase.getInstance(this);

        db.cartDao().getAllItems().observe(this, items -> {
            cartItemCount = 0;

            if (items != null) {
                for (CartItem item : items) {
                    cartItemCount += item.getQuantity();
                }
            }

            updateCartButton();
        });
    }

    private void updateCartButton() {
        if (cartItemCount > 0) {
            binding.fabCart.setText("View Cart (" + cartItemCount + ")");
            binding.fabCart.setVisibility(View.VISIBLE);
        } else {
            binding.fabCart.setText("View Cart");
        }
    }

    @Override
    public void onAddToCart(MenuItem menuItem) {
        Executors.newSingleThreadExecutor().execute(() -> {
            AppDatabase db = AppDatabase.getInstance(this);
            CartItem existing = db.cartDao().getItemById(menuItem.getId());

            if (existing != null) {
                existing.setQuantity(existing.getQuantity() + 1);
                db.cartDao().update(existing);
            } else {
                CartItem newItem = new CartItem();
                newItem.setItemId(menuItem.getId());
                newItem.setName(menuItem.getName());
                newItem.setPrice(menuItem.getPrice());
                newItem.setQuantity(1);
                newItem.setImageUrl(menuItem.getImageUrl());
                newItem.setRestaurantId(restaurantId);
                newItem.setRestaurantName(restaurantName);
                newItem.setRestaurantLat(restaurantLat);
                newItem.setRestaurantLng(restaurantLng);
                db.cartDao().insert(newItem);
            }

            cartItemCount++;
            runOnUiThread(() -> {
                updateCartButton();
                Toast.makeText(this, menuItem.getName() + " added to cart", Toast.LENGTH_SHORT).show();
            });
        });
    }
}
