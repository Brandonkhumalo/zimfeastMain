package com.zimfeast.customer.ui.customer;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.MenuItem;
import android.view.View;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.ActionBarDrawerToggle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.view.GravityCompat;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.material.navigation.NavigationView;
import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.local.AppDatabase;
import com.zimfeast.customer.data.model.RestaurantResponse;
import com.zimfeast.customer.data.model.Restaurant;
import com.zimfeast.customer.databinding.ActivityCustomerBinding;
import com.zimfeast.customer.ui.auth.LoginActivity;
import com.zimfeast.customer.ui.cart.CartActivity;
import com.zimfeast.customer.ui.history.OrderHistoryActivity;
import com.zimfeast.customer.ui.menu.MenuActivity;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CustomerActivity extends AppCompatActivity implements 
        RestaurantAdapter.OnRestaurantClickListener,
        NavigationView.OnNavigationItemSelectedListener {

    private static final int LOCATION_PERMISSION_CODE = 1001;

    private ActivityCustomerBinding binding;
    private RestaurantAdapter restaurantAdapter;
    private RestaurantAdapter topRestaurantAdapter;
    private RestaurantAdapter nearbyRestaurantAdapter;
    private FusedLocationProviderClient fusedLocationClient;
    private ActionBarDrawerToggle drawerToggle;

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

        setupToolbar();
        setupNavigationDrawer();
        setupCuisineFilters();
        setupRecyclerViews();
        setupSearch();
        setupClickListeners();

        loadRestaurants();
        observeCart();
    }

    private void setupToolbar() {
        setSupportActionBar(binding.toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayShowTitleEnabled(false);
        }
    }

    private void setupNavigationDrawer() {
        drawerToggle = new ActionBarDrawerToggle(
                this,
                binding.drawerLayout,
                binding.toolbar,
                R.string.app_name,
                R.string.app_name
        );
        binding.drawerLayout.addDrawerListener(drawerToggle);
        drawerToggle.syncState();

        binding.navView.setNavigationItemSelectedListener(this);
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

        nearbyRestaurantAdapter = new RestaurantAdapter(new ArrayList<>(), currentCurrency, this);
        binding.rvNearbyRestaurants.setLayoutManager(new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        binding.rvNearbyRestaurants.setAdapter(nearbyRestaurantAdapter);
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

        binding.ivSettings.setOnClickListener(v -> {
            Toast.makeText(this, "Settings coming soon", Toast.LENGTH_SHORT).show();
        });

        binding.cardChefZim.setOnClickListener(v -> openChefZimDialog());
        binding.btnTryAi.setOnClickListener(v -> openChefZimDialog());

        binding.swipeRefresh.setOnRefreshListener(this::loadRestaurants);
    }

    private void openChefZimDialog() {
        Toast.makeText(this, "Chef Zim AI recommendations coming soon!", Toast.LENGTH_SHORT).show();
    }

    private void loadRestaurants() {
        binding.swipeRefresh.setRefreshing(true);

        ApiClient.getInstance().getApiService().getNearbyRestaurants(null, null, 100).enqueue(new Callback<RestaurantResponse>() {
            @Override
            public void onResponse(Call<RestaurantResponse> call, Response<RestaurantResponse> response) {
                binding.swipeRefresh.setRefreshing(false);

                if (response.isSuccessful() && response.body() != null) {
                    allRestaurants = response.body().getResults();
                    updateAllSections();
                } else {
                    loadDemoRestaurants();
                }
            }

            @Override
            public void onFailure(Call<RestaurantResponse> call, Throwable t) {
                binding.swipeRefresh.setRefreshing(false);
                loadDemoRestaurants();
            }
        });
    }

    private void loadDemoRestaurants() {
        allRestaurants = getDemoRestaurants();
        updateAllSections();
    }

    private void updateAllSections() {
        filterRestaurants();

        List<Restaurant> topRated = new ArrayList<>();
        List<Restaurant> nearby = new ArrayList<>();

        for (Restaurant r : allRestaurants) {
            if (r.getRating() >= 4.5) {
                topRated.add(r);
            }
        }

        if (hasLocation) {
            List<Restaurant> sortedByDistance = new ArrayList<>(allRestaurants);
            sortedByDistance.sort((a, b) -> {
                double distA = calculateDistance(a);
                double distB = calculateDistance(b);
                return Double.compare(distA, distB);
            });
            nearby = sortedByDistance.subList(0, Math.min(5, sortedByDistance.size()));
        } else {
            nearby = allRestaurants.subList(0, Math.min(5, allRestaurants.size()));
        }

        topRestaurantAdapter.updateData(topRated);
        nearbyRestaurantAdapter.updateData(nearby);
    }

    private double calculateDistance(Restaurant restaurant) {
        if (restaurant.getCoordinates() == null || !hasLocation) {
            return Double.MAX_VALUE;
        }
        double rLat = restaurant.getCoordinates().getLat();
        double rLng = restaurant.getCoordinates().getLng();
        double latDiff = userLat - rLat;
        double lngDiff = userLng - rLng;
        return Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
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

        Restaurant wimpy = new Restaurant();
        wimpy.setId("wimpy-borrowdale");
        wimpy.setName("Wimpy Borrowdale");
        wimpy.setDescription("Classic burgers and fries");
        wimpy.setCuisineType("fast_food");
        wimpy.setRating(4.2);
        wimpy.setEstimatedDeliveryTime(25);
        demos.add(wimpy);

        Restaurant mugg = new Restaurant();
        mugg.setId("mugg-bean");
        mugg.setName("Mugg & Bean");
        mugg.setDescription("Coffee and breakfast");
        mugg.setCuisineType("breakfast");
        mugg.setRating(4.4);
        mugg.setEstimatedDeliveryTime(30);
        demos.add(mugg);

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
                nearbyRestaurantAdapter.setUserLocation(userLat, userLng);
                binding.tvNearbyTitle.setText(getString(R.string.restaurants_near_you));
                updateAllSections();
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
    public boolean onNavigationItemSelected(@NonNull MenuItem item) {
        int id = item.getItemId();

        if (id == R.id.nav_home) {
            binding.drawerLayout.closeDrawer(GravityCompat.START);
        } else if (id == R.id.nav_orders) {
            startActivity(new Intent(this, OrderHistoryActivity.class));
        } else if (id == R.id.nav_favorites) {
            Toast.makeText(this, "Favorites coming soon", Toast.LENGTH_SHORT).show();
        } else if (id == R.id.nav_settings) {
            Toast.makeText(this, "Settings coming soon", Toast.LENGTH_SHORT).show();
        } else if (id == R.id.nav_help) {
            Toast.makeText(this, "Help & Support coming soon", Toast.LENGTH_SHORT).show();
        } else if (id == R.id.nav_logout) {
            logout();
        }

        binding.drawerLayout.closeDrawer(GravityCompat.START);
        return true;
    }

    private void logout() {
        ApiClient.getInstance().getTokenManager().clearTokens();
        startActivity(new Intent(this, LoginActivity.class));
        finish();
    }

    @Override
    public void onBackPressed() {
        if (binding.drawerLayout.isDrawerOpen(GravityCompat.START)) {
            binding.drawerLayout.closeDrawer(GravityCompat.START);
        } else {
            super.onBackPressed();
        }
    }

    @Override
    public void onAddToCart(Restaurant restaurant) {
        Intent intent = new Intent(this, MenuActivity.class);
        intent.putExtra("restaurantId", restaurant.getId());
        intent.putExtra("restaurantName", restaurant.getName());
        intent.putExtra("restaurantImage", restaurant.getImageUrl());
        intent.putExtra("restaurantCuisine", restaurant.getFormattedCuisine());
        intent.putExtra("restaurantRating", restaurant.getRating());
        intent.putExtra("deliveryTime", restaurant.getEstimatedDeliveryTime());
        if (restaurant.getCoordinates() != null) {
            intent.putExtra("restaurantLat", restaurant.getCoordinates().getLat());
            intent.putExtra("restaurantLng", restaurant.getCoordinates().getLng());
        }
        intent.putExtra("currency", currentCurrency);
        startActivity(intent);
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
