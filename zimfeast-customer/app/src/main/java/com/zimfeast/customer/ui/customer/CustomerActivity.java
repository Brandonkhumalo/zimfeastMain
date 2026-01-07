package com.zimfeast.customer.ui.customer;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.local.AppDatabase;
import com.zimfeast.customer.data.model.CartItem;
import com.zimfeast.customer.data.model.Restaurant;
import com.zimfeast.customer.databinding.ActivityCustomerBinding;
import com.zimfeast.customer.ui.auth.LoginActivity;
import com.zimfeast.customer.ui.cart.CartActivity;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.Executors;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CustomerActivity extends AppCompatActivity implements RestaurantAdapter.OnRestaurantClickListener {

    private static final int LOCATION_PERMISSION_CODE = 1001;

    private ActivityCustomerBinding binding;
    private RestaurantAdapter restaurantAdapter;
    private RestaurantAdapter topRestaurantAdapter;
    private FusedLocationProviderClient fusedLocationClient;

    private List<Restaurant> allRestaurants = new ArrayList<>();
    private String selectedCuisine = "";
    private String currentCurrency = "USD";
    private double userLat = 0;
    private double userLng = 0;
    private boolean hasLocation = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityCustomerBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        if (!ApiClient.getInstance().getTokenManager().isLoggedIn()) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        setupCurrencySpinner();
        setupCuisineFilters();
        setupRecyclerViews();
        setupSearch();
        setupClickListeners();

        loadRestaurants();
        observeCart();
    }

    private void setupCurrencySpinner() {
        String[] currencies = {getString(R.string.usd), getString(R.string.zwl)};
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, currencies);
        binding.spinnerCurrency.setAdapter(adapter);
    }

    private void setupCuisineFilters() {
        List<CuisineFilter> cuisines = Arrays.asList(
                new CuisineFilter("", getString(R.string.all_restaurants)),
                new CuisineFilter("fast_food", getString(R.string.fast_food)),
                new CuisineFilter("traditional", getString(R.string.traditional)),
                new CuisineFilter("breakfast", getString(R.string.breakfast)),
                new CuisineFilter("pizza", getString(R.string.pizza)),
                new CuisineFilter("chinese", getString(R.string.chinese)),
                new CuisineFilter("indian", getString(R.string.indian)),
                new CuisineFilter("lunch_pack", getString(R.string.lunch_pack))
        );

        CuisineFilterAdapter adapter = new CuisineFilterAdapter(cuisines, cuisine -> {
            selectedCuisine = cuisine;
            filterRestaurants();
        });

        binding.rvCuisines.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        binding.rvCuisines.setAdapter(adapter);
    }

    private void setupRecyclerViews() {
        restaurantAdapter = new RestaurantAdapter(new ArrayList<>(), currentCurrency, this);
        binding.rvRestaurants.setLayoutManager(new GridLayoutManager(this, 2));
        binding.rvRestaurants.setAdapter(restaurantAdapter);

        topRestaurantAdapter = new RestaurantAdapter(new ArrayList<>(), currentCurrency, this);
        binding.rvTopRestaurants.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        binding.rvTopRestaurants.setAdapter(topRestaurantAdapter);
    }

    private void setupSearch() {
        binding.etSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                filterRestaurants();
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });
    }

    private void setupClickListeners() {
        binding.btnLocation.setOnClickListener(v -> requestLocation());

        binding.fabCart.setOnClickListener(v -> {
            startActivity(new Intent(this, CartActivity.class));
        });

        binding.swipeRefresh.setOnRefreshListener(this::loadRestaurants);
    }

    private void loadRestaurants() {
        binding.swipeRefresh.setRefreshing(true);

        ApiClient.getInstance().getApiService().getRestaurants().enqueue(new Callback<List<Restaurant>>() {
            @Override
            public void onResponse(Call<List<Restaurant>> call, Response<List<Restaurant>> response) {
                binding.swipeRefresh.setRefreshing(false);

                if (response.isSuccessful() && response.body() != null) {
                    allRestaurants = response.body();
                    filterRestaurants();

                    List<Restaurant> topRated = new ArrayList<>();
                    for (Restaurant r : allRestaurants) {
                        if (r.getRating() >= 4.5) {
                            topRated.add(r);
                        }
                    }
                    topRestaurantAdapter.updateData(topRated);
                } else {
                    loadDemoRestaurants();
                }
            }

            @Override
            public void onFailure(Call<List<Restaurant>> call, Throwable t) {
                binding.swipeRefresh.setRefreshing(false);
                loadDemoRestaurants();
            }
        });
    }

    private void loadDemoRestaurants() {
        allRestaurants = getDemoRestaurants();
        filterRestaurants();

        List<Restaurant> topRated = new ArrayList<>();
        for (Restaurant r : allRestaurants) {
            if (r.getRating() >= 4.5) {
                topRated.add(r);
            }
        }
        topRestaurantAdapter.updateData(topRated);
    }

    private List<Restaurant> getDemoRestaurants() {
        List<Restaurant> demos = new ArrayList<>();

        Restaurant kfc = new Restaurant();
        kfc.setId("kfc-harare");
        kfc.setName("KFC Harare");
        kfc.setDescription("Finger Lickin' Good");
        kfc.setCuisineType("fast_food");
        kfc.setRating(4.6);
        kfc.setEstimatedDeliveryTime(25);
        demos.add(kfc);

        Restaurant sadza = new Restaurant();
        sadza.setId("sadza-house");
        sadza.setName("Sadza House");
        sadza.setDescription("Authentic Zimbabwean cuisine");
        sadza.setCuisineType("traditional");
        sadza.setRating(4.8);
        sadza.setEstimatedDeliveryTime(35);
        demos.add(sadza);

        Restaurant pizzaInn = new Restaurant();
        pizzaInn.setId("pizza-inn");
        pizzaInn.setName("Pizza Inn");
        pizzaInn.setDescription("Hot and Fresh");
        pizzaInn.setCuisineType("pizza");
        pizzaInn.setRating(4.3);
        pizzaInn.setEstimatedDeliveryTime(30);
        demos.add(pizzaInn);

        Restaurant nandos = new Restaurant();
        nandos.setId("nandos-eastgate");
        nandos.setName("Nando's Eastgate");
        nandos.setDescription("Peri-Peri Chicken");
        nandos.setCuisineType("fast_food");
        nandos.setRating(4.5);
        nandos.setEstimatedDeliveryTime(20);
        demos.add(nandos);

        return demos;
    }

    private void filterRestaurants() {
        String searchTerm = binding.etSearch.getText().toString().toLowerCase().trim();
        List<Restaurant> filtered = new ArrayList<>();

        for (Restaurant r : allRestaurants) {
            boolean matchesCuisine = selectedCuisine.isEmpty() ||
                    (r.getCuisineType() != null && r.getCuisineType().equals(selectedCuisine));

            boolean matchesSearch = searchTerm.isEmpty() ||
                    (r.getName() != null && r.getName().toLowerCase().contains(searchTerm)) ||
                    (r.getDescription() != null && r.getDescription().toLowerCase().contains(searchTerm));

            if (matchesCuisine && matchesSearch) {
                filtered.add(r);
            }
        }

        restaurantAdapter.updateData(filtered);
        binding.tvEmptyState.setVisibility(filtered.isEmpty() ? View.VISIBLE : View.GONE);
    }

    private void requestLocation() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.ACCESS_FINE_LOCATION},
                    LOCATION_PERMISSION_CODE);
            return;
        }

        binding.btnLocation.setEnabled(false);
        binding.btnLocation.setText(getString(R.string.getting_location));

        fusedLocationClient.getLastLocation().addOnSuccessListener(this, location -> {
            binding.btnLocation.setEnabled(true);

            if (location != null) {
                userLat = location.getLatitude();
                userLng = location.getLongitude();
                hasLocation = true;
                binding.btnLocation.setText(getString(R.string.show_all));
                restaurantAdapter.setUserLocation(userLat, userLng);
                Toast.makeText(this, "Location found!", Toast.LENGTH_SHORT).show();
            } else {
                binding.btnLocation.setText(getString(R.string.find_nearby));
                Toast.makeText(this, getString(R.string.error_location), Toast.LENGTH_SHORT).show();
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_CODE && grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            requestLocation();
        }
    }

    @Override
    public void onAddToCart(Restaurant restaurant) {
        CartItem item = new CartItem(
                restaurant.getId() + "-sample",
                "Sample Dish from " + restaurant.getName(),
                5.99,
                1,
                restaurant.getId(),
                restaurant.getName()
        );

        Executors.newSingleThreadExecutor().execute(() -> {
            AppDatabase.getInstance(this).cartDao().insert(item);
            runOnUiThread(() -> Toast.makeText(this, "Added to cart!", Toast.LENGTH_SHORT).show());
        });
    }

    private void observeCart() {
        AppDatabase.getInstance(this).cartDao().getItemCount().observe(this, count -> {
            if (count != null && count > 0) {
                binding.fabCart.setVisibility(View.VISIBLE);
                binding.tvCartBadge.setVisibility(View.VISIBLE);
                binding.tvCartBadge.setText(String.valueOf(count));
            } else {
                binding.tvCartBadge.setVisibility(View.GONE);
            }
        });
    }

    public static class CuisineFilter {
        public String key;
        public String label;

        public CuisineFilter(String key, String label) {
            this.key = key;
            this.label = label;
        }
    }
}
