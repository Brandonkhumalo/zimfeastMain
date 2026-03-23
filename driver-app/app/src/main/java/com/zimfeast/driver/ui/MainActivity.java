package com.zimfeast.driver.ui;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.google.android.material.switchmaterial.SwitchMaterial;
import com.zimfeast.driver.R;
import com.zimfeast.driver.ZimFeastDriverApp;
import com.zimfeast.driver.data.api.ApiClient;
import com.zimfeast.driver.data.api.ApiService;
import com.zimfeast.driver.data.model.DailyFinance;
import com.zimfeast.driver.data.model.DeliveryOffer;
import com.zimfeast.driver.data.model.DriverProfile;
import com.zimfeast.driver.data.model.StatusUpdateRequest;
import com.zimfeast.driver.service.LocationService;
import com.zimfeast.driver.socket.SocketManager;
import com.zimfeast.driver.util.NetworkUtils;
import com.google.android.material.snackbar.Snackbar;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class MainActivity extends AppCompatActivity implements SocketManager.SocketListener {

    private static final int LOCATION_PERMISSION_REQUEST = 1001;

    // -- Home tab views --
    private SwitchMaterial switchOnline;
    private TextView tvStatus;
    private TextView tvDriverName;
    private TextView tvOfflineMessage;
    private CardView cardDeliveryOffer;
    private TextView tvOfferRestaurant;
    private TextView tvOfferAddress;
    private TextView tvOfferDistance;
    private TextView tvOfferEarnings;
    private TextView tvOfferTimer;
    private Button btnAccept;
    private Button btnDecline;

    // -- Tab containers --
    private LinearLayout homeContent;
    private ScrollView earningsContent;
    private ScrollView settingsContent;
    private BottomNavigationView bottomNav;

    // -- Settings tab views --
    private TextView tvSettingsName;
    private TextView tvSettingsPhone;
    private TextView tvSettingsVehicle;
    private View viewConnectionIndicator;
    private TextView tvConnectionStatus;
    private Button btnLogout;
    private Button btnEditProfile;         // Task 12: Edit Profile button
    private Button btnWhatsAppSupport;     // WhatsApp Support button

    // -- Earnings tab views (Task 11) --
    private TextView tvTotalEarnings;
    private TextView tvTotalDeliveries;
    private TextView tvTotalDistance;
    private TextView tvTotalTips;
    private TextView tvHoursOnline;
    private TextView tvAverageRating;
    private Button btnViewHistory;          // Task 13: View History button

    // -- Header rating views (Task 14) --
    private LinearLayout layoutHeaderRating;
    private TextView tvHeaderRating;

    // -- Recent Reviews section --
    private LinearLayout layoutRecentReviews;
    private TextView tvNoReviews;

    // -- Core state --
    private SocketManager socketManager;
    private ApiService apiService;
    private DeliveryOffer currentOffer;
    private android.os.CountDownTimer offerTimer;
    private static final int OFFER_TIMEOUT_SECONDS = 30;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Redirect to login if not authenticated
        if (ZimFeastDriverApp.getInstance().getAuthToken() == null) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }

        initViews();
        setupListeners();
        setupBottomNavigation();

        socketManager = SocketManager.getInstance();
        socketManager.addListener(this);

        apiService = ApiClient.getClient().create(ApiService.class);

        checkLocationPermission();
        updateSettingsInfo();

        // Initialize network monitoring and show offline banner
        NetworkUtils.init(this);
        NetworkUtils.isOnline().observe(this, online -> {
            if (!online) {
                View rootView = findViewById(android.R.id.content);
                Snackbar.make(rootView, "You are offline. Some features may be unavailable.",
                        Snackbar.LENGTH_INDEFINITE)
                        .setAction("Dismiss", v -> {})
                        .show();
            }
        });

        // Task 14: Fetch driver profile to display rating in header
        fetchDriverProfile();
    }

    private void initViews() {
        // Home tab
        switchOnline = findViewById(R.id.switch_online);
        tvStatus = findViewById(R.id.tv_status);
        tvDriverName = findViewById(R.id.tv_driver_name);
        cardDeliveryOffer = findViewById(R.id.card_delivery_offer);
        tvOfferRestaurant = findViewById(R.id.tv_offer_restaurant);
        tvOfferAddress = findViewById(R.id.tv_offer_address);
        tvOfferDistance = findViewById(R.id.tv_offer_distance);
        tvOfferEarnings = findViewById(R.id.tv_offer_earnings);
        tvOfferTimer = findViewById(R.id.tv_offer_timer);
        btnAccept = findViewById(R.id.btn_accept);
        btnDecline = findViewById(R.id.btn_decline);

        // Tab containers
        homeContent = findViewById(R.id.home_content);
        earningsContent = findViewById(R.id.earnings_content);
        settingsContent = findViewById(R.id.settings_content);
        bottomNav = findViewById(R.id.bottom_nav);

        // Settings tab
        tvSettingsName = findViewById(R.id.tv_settings_name);
        tvSettingsPhone = findViewById(R.id.tv_settings_phone);
        tvSettingsVehicle = findViewById(R.id.tv_settings_vehicle);
        viewConnectionIndicator = findViewById(R.id.view_connection_indicator);
        tvConnectionStatus = findViewById(R.id.tv_connection_status);
        btnLogout = findViewById(R.id.btn_logout);
        btnEditProfile = findViewById(R.id.btn_edit_profile);       // Task 12
        btnWhatsAppSupport = findViewById(R.id.btn_whatsapp_support); // WhatsApp Support

        // Earnings tab views (Task 11)
        tvTotalEarnings = findViewById(R.id.tv_total_earnings);
        tvTotalDeliveries = findViewById(R.id.tv_total_deliveries);
        tvTotalDistance = findViewById(R.id.tv_total_distance);
        tvTotalTips = findViewById(R.id.tv_total_tips);
        tvHoursOnline = findViewById(R.id.tv_hours_online);
        tvAverageRating = findViewById(R.id.tv_average_rating);
        btnViewHistory = findViewById(R.id.btn_view_history);       // Task 13

        // Header rating (Task 14)
        layoutHeaderRating = findViewById(R.id.layout_header_rating);
        tvHeaderRating = findViewById(R.id.tv_header_rating);

        tvOfflineMessage = findViewById(R.id.tv_offline_message);

        // Recent Reviews
        layoutRecentReviews = findViewById(R.id.layout_recent_reviews);
        tvNoReviews = findViewById(R.id.tv_no_reviews);

        tvDriverName.setText(ZimFeastDriverApp.getInstance().getDriverName());
        cardDeliveryOffer.setVisibility(View.GONE);
        updateOfflineMessage(false);
    }

    private void setupBottomNavigation() {
        bottomNav.setOnItemSelectedListener(item -> {
            int itemId = item.getItemId();
            if (itemId == R.id.nav_home) {
                showHome();
                return true;
            } else if (itemId == R.id.nav_earnings) {
                showEarnings();
                return true;
            } else if (itemId == R.id.nav_settings) {
                showSettings();
                return true;
            }
            return false;
        });
    }

    private void showHome() {
        homeContent.setVisibility(View.VISIBLE);
        earningsContent.setVisibility(View.GONE);
        settingsContent.setVisibility(View.GONE);
    }

    /**
     * Task 11: When the earnings tab is selected, show it and auto-refresh
     * the daily finances data from the API.
     */
    private void showEarnings() {
        homeContent.setVisibility(View.GONE);
        earningsContent.setVisibility(View.VISIBLE);
        settingsContent.setVisibility(View.GONE);

        // Auto-refresh earnings data every time the tab is selected
        fetchDailyFinances();
        // Also refresh recent review comments
        fetchRecentRatings();
    }

    private void showSettings() {
        homeContent.setVisibility(View.GONE);
        earningsContent.setVisibility(View.GONE);
        settingsContent.setVisibility(View.VISIBLE);
        updateSettingsInfo();
    }

    // ========================================================================
    // Task 11: Fetch and display daily finances in the earnings tab
    // ========================================================================

    /**
     * Calls GET /api/drivers/daily/finances/ and binds the response data
     * to the earnings tab views (total earnings, deliveries, tips, hours, rating).
     */
    private void fetchDailyFinances() {
        apiService.getDailyFinances().enqueue(new Callback<DailyFinance>() {
            @Override
            public void onResponse(Call<DailyFinance> call, Response<DailyFinance> response) {
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;

                    if (response.isSuccessful() && response.body() != null) {
                        DailyFinance finance = response.body();
                        bindEarningsData(finance);
                    }
                    // If the API call fails, the views retain their current/default values
                });
            }

            @Override
            public void onFailure(Call<DailyFinance> call, Throwable t) {
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    Toast.makeText(MainActivity.this,
                            "Could not refresh earnings", Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    /**
     * Binds the DailyFinance data to the earnings tab UI elements.
     * Updates total earnings, delivery count, tips, hours online, and average rating.
     */
    private void bindEarningsData(DailyFinance finance) {
        if (tvTotalEarnings != null) {
            tvTotalEarnings.setText(finance.getFormattedEarnings());
        }
        if (tvTotalDeliveries != null) {
            tvTotalDeliveries.setText(String.valueOf(finance.getTodayDeliveries()));
        }
        if (tvTotalTips != null) {
            tvTotalTips.setText(finance.getFormattedTips());
        }
        if (tvHoursOnline != null) {
            tvHoursOnline.setText(finance.getFormattedHours());
        }
        // Task 14: Display average rating from daily finances in the earnings tab
        if (tvAverageRating != null) {
            tvAverageRating.setText(String.format("%.1f", finance.getAverageRating()));
        }
    }

    // ========================================================================
    // Recent Reviews: Fetch and display rating comments in the earnings tab
    // ========================================================================

    /**
     * Calls GET /api/drivers/ratings/recent/ and dynamically adds review cards
     * into the layout_recent_reviews container. Each card shows the star rating
     * and the comment text. If no reviews are returned, a "No reviews yet"
     * placeholder is shown instead.
     */
    @SuppressWarnings("unchecked")
    private void fetchRecentRatings() {
        apiService.getRecentRatings().enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    if (layoutRecentReviews == null) return;

                    // Remove all views except the "no reviews" placeholder
                    layoutRecentReviews.removeAllViews();

                    if (response.isSuccessful() && response.body() != null) {
                        Object ratingsObj = response.body().get("ratings");
                        if (ratingsObj instanceof List) {
                            List<Map<String, Object>> ratings = (List<Map<String, Object>>) ratingsObj;

                            if (ratings.isEmpty()) {
                                addNoReviewsPlaceholder();
                                return;
                            }

                            for (Map<String, Object> entry : ratings) {
                                addReviewCard(entry);
                            }
                            return;
                        }
                    }
                    addNoReviewsPlaceholder();
                });
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                // Silently fail — keep existing content
            }
        });
    }

    /** Adds a "No reviews yet" placeholder text into the reviews container. */
    private void addNoReviewsPlaceholder() {
        if (layoutRecentReviews == null) return;
        TextView tv = new TextView(this);
        tv.setText("No reviews yet");
        tv.setTextSize(14);
        tv.setTextColor(getResources().getColor(R.color.text_tertiary, getTheme()));
        tv.setTextAlignment(View.TEXT_ALIGNMENT_CENTER);
        tv.setPadding(0, 32, 0, 32);
        layoutRecentReviews.addView(tv);
    }

    /**
     * Creates a single review card (rating stars + comment) and appends it to
     * the reviews container. Each card has a rounded background, star display,
     * and the review comment text.
     */
    private void addReviewCard(Map<String, Object> entry) {
        if (layoutRecentReviews == null) return;

        // Extract rating and comment
        double rating = 0;
        Object ratingObj = entry.get("rating");
        if (ratingObj instanceof Number) {
            rating = ((Number) ratingObj).doubleValue();
        }
        String comment = "";
        Object commentObj = entry.get("comment");
        if (commentObj instanceof String) {
            comment = (String) commentObj;
        }

        // Card container
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        int paddingPx = (int) (14 * getResources().getDisplayMetrics().density);
        int marginPx = (int) (6 * getResources().getDisplayMetrics().density);
        card.setPadding(paddingPx, paddingPx, paddingPx, paddingPx);

        LinearLayout.LayoutParams cardParams = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        cardParams.setMargins(0, marginPx, 0, marginPx);
        card.setLayoutParams(cardParams);
        card.setBackgroundResource(R.drawable.bg_outlined_box);

        // Star rating text (e.g., "4.0 stars")
        TextView tvRating = new TextView(this);
        StringBuilder stars = new StringBuilder();
        int fullStars = (int) rating;
        for (int i = 0; i < fullStars; i++) stars.append("\u2605"); // filled star
        for (int i = fullStars; i < 5; i++) stars.append("\u2606"); // empty star
        tvRating.setText(stars.toString());
        tvRating.setTextSize(18);
        tvRating.setTextColor(getResources().getColor(R.color.rating_star, getTheme()));
        card.addView(tvRating);

        // Comment text (only if non-empty)
        if (!comment.isEmpty()) {
            TextView tvComment = new TextView(this);
            tvComment.setText(comment);
            tvComment.setTextSize(13);
            tvComment.setTextColor(getResources().getColor(R.color.text_secondary, getTheme()));
            int topMargin = (int) (6 * getResources().getDisplayMetrics().density);
            LinearLayout.LayoutParams commentParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
            commentParams.setMargins(0, topMargin, 0, 0);
            tvComment.setLayoutParams(commentParams);
            card.addView(tvComment);
        }

        layoutRecentReviews.addView(card);
    }

    // ========================================================================
    // Task 14: Fetch driver profile to display overall rating in the header
    // ========================================================================

    /**
     * Calls GET /api/drivers/profile/ and uses the rating field to display
     * the overall driver rating badge in the header area.
     */
    private void fetchDriverProfile() {
        apiService.getDriverProfile().enqueue(new Callback<DriverProfile>() {
            @Override
            public void onResponse(Call<DriverProfile> call, Response<DriverProfile> response) {
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;

                    if (response.isSuccessful() && response.body() != null) {
                        DriverProfile profile = response.body();
                        double rating = profile.getRating();

                        // Show the rating badge only if the driver has a rating > 0
                        if (layoutHeaderRating != null && tvHeaderRating != null) {
                            if (rating > 0) {
                                layoutHeaderRating.setVisibility(View.VISIBLE);
                                tvHeaderRating.setText(String.format("%.1f", rating));
                            } else {
                                layoutHeaderRating.setVisibility(View.GONE);
                            }
                        }

                        // Also update driver info from profile if available
                        String fullName = profile.getFullName().trim();
                        if (!fullName.isEmpty() && !fullName.equals(" ")) {
                            tvDriverName.setText(fullName);
                        }
                    }
                });
            }

            @Override
            public void onFailure(Call<DriverProfile> call, Throwable t) {
                // Silently fail — the header rating badge stays hidden
            }
        });
    }

    // ========================================================================
    // Task 12: Edit Profile dialog
    // ========================================================================

    /**
     * Shows an AlertDialog with EditText fields for phone number and vehicle info.
     * Pre-populates with current values from SharedPreferences.
     * On save, calls PATCH /api/drivers/profile/ and updates local storage.
     */
    private void showEditProfileDialog() {
        AlertDialog.Builder builder = new AlertDialog.Builder(this);
        builder.setTitle("Edit Profile");

        // Create a vertical LinearLayout to hold the input fields
        LinearLayout dialogLayout = new LinearLayout(this);
        dialogLayout.setOrientation(LinearLayout.VERTICAL);
        int paddingPx = (int) (20 * getResources().getDisplayMetrics().density);
        dialogLayout.setPadding(paddingPx, paddingPx, paddingPx, 0);

        // Phone number input field
        TextView phoneLabel = new TextView(this);
        phoneLabel.setText("Phone Number");
        phoneLabel.setTextSize(14);
        phoneLabel.setTextColor(ContextCompat.getColor(this, R.color.text_secondary));
        dialogLayout.addView(phoneLabel);

        EditText editPhone = new EditText(this);
        editPhone.setInputType(InputType.TYPE_CLASS_PHONE);
        editPhone.setHint("e.g. +263 77 123 4567");
        String currentPhone = ZimFeastDriverApp.getInstance().getDriverPhone();
        if (!currentPhone.isEmpty()) {
            editPhone.setText(currentPhone);
        }
        dialogLayout.addView(editPhone);

        // Spacer between fields
        View spacer = new View(this);
        spacer.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                (int) (16 * getResources().getDisplayMetrics().density)));
        dialogLayout.addView(spacer);

        // Vehicle type input field
        TextView vehicleLabel = new TextView(this);
        vehicleLabel.setText("Vehicle Type");
        vehicleLabel.setTextSize(14);
        vehicleLabel.setTextColor(ContextCompat.getColor(this, R.color.text_secondary));
        dialogLayout.addView(vehicleLabel);

        EditText editVehicle = new EditText(this);
        editVehicle.setInputType(InputType.TYPE_CLASS_TEXT);
        editVehicle.setHint("e.g. Motorcycle, Car, Bicycle");
        String currentVehicle = ZimFeastDriverApp.getInstance().getDriverVehicle();
        editVehicle.setText(currentVehicle);
        dialogLayout.addView(editVehicle);

        builder.setView(dialogLayout);

        // Save button — calls the update profile API
        builder.setPositiveButton("Save", (dialog, which) -> {
            String newPhone = editPhone.getText().toString().trim();
            String newVehicle = editVehicle.getText().toString().trim();

            if (newPhone.isEmpty() && newVehicle.isEmpty()) {
                Toast.makeText(this, "No changes to save", Toast.LENGTH_SHORT).show();
                return;
            }

            updateProfile(newPhone, newVehicle);
        });

        // Cancel button — dismisses without saving
        builder.setNegativeButton("Cancel", (dialog, which) -> dialog.dismiss());

        builder.show();
    }

    /**
     * Sends PATCH /api/drivers/profile/ with the updated phone and vehicle type.
     * On success, persists changes to SharedPreferences and refreshes the settings display.
     */
    private void updateProfile(String phone, String vehicleType) {
        // Build the request body with only the fields that have values
        Map<String, Object> updates = new HashMap<>();
        if (!phone.isEmpty()) {
            updates.put("phone_number", phone);
        }
        if (!vehicleType.isEmpty()) {
            updates.put("vehicle_type", vehicleType);
        }

        if (updates.isEmpty()) return;

        apiService.updateDriverProfile(updates).enqueue(new Callback<DriverProfile>() {
            @Override
            public void onResponse(Call<DriverProfile> call, Response<DriverProfile> response) {
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;

                    if (response.isSuccessful() && response.body() != null) {
                        DriverProfile updated = response.body();

                        // Persist the updated values to SharedPreferences
                        ZimFeastDriverApp app = ZimFeastDriverApp.getInstance();
                        app.saveDriverInfo(
                                app.getDriverId(),
                                app.getDriverName(),
                                updated.getPhoneNumber() != null ? updated.getPhoneNumber() : phone,
                                updated.getVehicleType() != null ? updated.getVehicleType() : vehicleType
                        );

                        // Refresh the settings display with new values
                        updateSettingsInfo();

                        Toast.makeText(MainActivity.this,
                                "Profile updated successfully", Toast.LENGTH_SHORT).show();
                    } else {
                        Toast.makeText(MainActivity.this,
                                "Failed to update profile", Toast.LENGTH_SHORT).show();
                    }
                });
            }

            @Override
            public void onFailure(Call<DriverProfile> call, Throwable t) {
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    Toast.makeText(MainActivity.this,
                            "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    // ========================================================================
    // Settings & Connection
    // ========================================================================

    private void updateSettingsInfo() {
        ZimFeastDriverApp app = ZimFeastDriverApp.getInstance();
        if (tvSettingsName != null) {
            tvSettingsName.setText(app.getDriverName());
        }
        if (tvSettingsPhone != null) {
            String phone = app.getDriverPhone();
            tvSettingsPhone.setText(phone.isEmpty() ? "Not set" : phone);
        }
        if (tvSettingsVehicle != null) {
            tvSettingsVehicle.setText(app.getDriverVehicle());
        }
        updateConnectionStatus(socketManager != null && socketManager.isConnected());
    }

    private void updateConnectionStatus(boolean connected) {
        if (viewConnectionIndicator != null) {
            GradientDrawable drawable = new GradientDrawable();
            drawable.setShape(GradientDrawable.OVAL);
            drawable.setColor(connected ? 0xFF4CAF50 : 0xFFF44336);
            viewConnectionIndicator.setBackground(drawable);
        }
        if (tvConnectionStatus != null) {
            tvConnectionStatus.setText(connected ? "Connected" : "Disconnected");
        }
    }

    // ========================================================================
    // Listeners setup
    // ========================================================================

    private void setupListeners() {
        switchOnline.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (isChecked) {
                goOnline();
            } else {
                goOffline();
            }
        });

        btnAccept.setOnClickListener(v -> {
            if (currentOffer != null) {
                acceptDelivery();
            }
        });

        btnDecline.setOnClickListener(v -> {
            if (currentOffer != null) {
                declineDelivery();
            }
        });

        if (btnLogout != null) {
            btnLogout.setOnClickListener(v -> logout());
        }

        // Task 12: Edit Profile button opens the edit dialog
        if (btnEditProfile != null) {
            btnEditProfile.setOnClickListener(v -> showEditProfileDialog());
        }

        // WhatsApp Support button opens WhatsApp chat with ZimFeast support
        if (btnWhatsAppSupport != null) {
            btnWhatsAppSupport.setOnClickListener(v -> openWhatsAppSupport());
        }

        // Task 13: View History button opens the OrderHistoryActivity
        if (btnViewHistory != null) {
            btnViewHistory.setOnClickListener(v -> {
                Intent intent = new Intent(MainActivity.this, OrderHistoryActivity.class);
                startActivity(intent);
            });
        }
    }

    // ========================================================================
    // Auth / Logout
    // ========================================================================

    private void logout() {
        // Stop location service
        Intent serviceIntent = new Intent(this, LocationService.class);
        stopService(serviceIntent);

        // Disconnect socket
        if (socketManager != null) {
            socketManager.goOfflineAndDisconnect();
        }

        ZimFeastDriverApp.getInstance().logout();

        Intent intent = new Intent(this, LoginActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);
        finish();
    }

    // ========================================================================
    // WhatsApp Support
    // ========================================================================

    /**
     * Opens WhatsApp chat with ZimFeast support number (+263781603382).
     * Uses the wa.me deep link which works whether WhatsApp is installed or not.
     */
    private void openWhatsAppSupport() {
        String url = "https://wa.me/263781603382?text=" + Uri.encode("Hi ZimFeast, I need help with...");
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        try {
            startActivity(intent);
        } catch (Exception e) {
            // Fallback: open in browser if no app can handle the intent
            Intent browserIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            browserIntent.setPackage(null);
            startActivity(browserIntent);
        }
    }

    // ========================================================================
    // Permissions
    // ========================================================================

    private void checkLocationPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                    this,
                    new String[]{
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                    },
                    LOCATION_PERMISSION_REQUEST
            );
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Location permission granted", Toast.LENGTH_SHORT).show();
            } else {
                Toast.makeText(this, "Location permission is required", Toast.LENGTH_LONG).show();
            }
        }
    }

    // ========================================================================
    // Online / Offline toggle
    // ========================================================================

    private void goOnline() {
        tvStatus.setText("Connecting...");
        updateOfflineMessage(true);
        socketManager.connect();

        Intent serviceIntent = new Intent(this, LocationService.class);
        ContextCompat.startForegroundService(this, serviceIntent);

        ZimFeastDriverApp.getInstance().setOnline(true);
    }

    private void updateOfflineMessage(boolean isOnline) {
        if (tvOfflineMessage != null) {
            tvOfflineMessage.setText(isOnline ? "Waiting for deliveries..." : "Go online to receive delivery offers");
        }
    }

    private void goOffline() {
        tvStatus.setText("Offline");
        updateOfflineMessage(false);
        socketManager.goOfflineAndDisconnect();

        Intent serviceIntent = new Intent(this, LocationService.class);
        stopService(serviceIntent);

        ZimFeastDriverApp.getInstance().setOnline(false);
        hideDeliveryOffer();
        updateConnectionStatus(false);
    }

    // ========================================================================
    // Delivery offer handling
    // ========================================================================

    private void showDeliveryOffer(DeliveryOffer offer) {
        currentOffer = offer;
        runOnUiThread(() -> {
            tvOfferRestaurant.setText(offer.getRestaurantName());
            tvOfferAddress.setText(offer.getDropoffAddress());
            tvOfferDistance.setText(offer.getDistance() + " km away");
            tvOfferEarnings.setText(String.format("$%.2f", offer.getTotalEarnings()));
            cardDeliveryOffer.setVisibility(View.VISIBLE);

            startOfferTimer(offer.getExpiresIn());
        });
    }

    private void hideDeliveryOffer() {
        runOnUiThread(() -> {
            cardDeliveryOffer.setVisibility(View.GONE);
            currentOffer = null;
            if (offerTimer != null) {
                offerTimer.cancel();
            }
        });
    }

    private void startOfferTimer(int seconds) {
        if (offerTimer != null) {
            offerTimer.cancel();
        }

        int timeoutSeconds = Math.min(seconds, OFFER_TIMEOUT_SECONDS);

        offerTimer = new android.os.CountDownTimer(timeoutSeconds * 1000L, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                int secondsLeft = (int) (millisUntilFinished / 1000);
                tvOfferTimer.setText(secondsLeft + "s");

                // Color shifts to warn driver as time runs out
                if (secondsLeft <= 10) {
                    tvOfferTimer.setTextColor(0xFFFF0000);
                } else if (secondsLeft <= 20) {
                    tvOfferTimer.setTextColor(0xFFFF5722);
                }
            }

            @Override
            public void onFinish() {
                autoDeclineDelivery();
            }
        }.start();
    }

    private void autoDeclineDelivery() {
        if (currentOffer != null) {
            String orderId = currentOffer.getOrderId();
            socketManager.rejectDelivery(orderId, "Timeout - auto declined");

            apiService.rejectOrder(orderId).enqueue(new Callback<Map<String, Object>>() {
                @Override
                public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                    runOnUiThread(() -> {
                        if (isFinishing() || isDestroyed()) return;
                        hideDeliveryOffer();
                        Toast.makeText(MainActivity.this, "Offer expired - auto declined", Toast.LENGTH_SHORT).show();
                    });
                }

                @Override
                public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                    runOnUiThread(() -> {
                        if (isFinishing() || isDestroyed()) return;
                        hideDeliveryOffer();
                        Toast.makeText(MainActivity.this, "Offer expired", Toast.LENGTH_SHORT).show();
                    });
                }
            });
        } else {
            hideDeliveryOffer();
            Toast.makeText(MainActivity.this, "Offer expired", Toast.LENGTH_SHORT).show();
        }
    }

    private void acceptDelivery() {
        if (currentOffer != null) {
            btnAccept.setEnabled(false);
            btnAccept.setText("Accepting...");
            btnDecline.setEnabled(false);

            String orderId = currentOffer.getOrderId();

            socketManager.acceptDelivery(orderId);

            apiService.acceptOrder(orderId).enqueue(new Callback<Map<String, Object>>() {
                @Override
                public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                    if (response.isSuccessful()) {
                        runOnUiThread(() -> {
                            if (isFinishing() || isDestroyed()) return;
                            if (offerTimer != null) {
                                offerTimer.cancel();
                            }
                        });
                    } else {
                        runOnUiThread(() -> {
                            if (isFinishing() || isDestroyed()) return;
                            Toast.makeText(MainActivity.this, "Failed to accept order", Toast.LENGTH_SHORT).show();
                            btnAccept.setEnabled(true);
                            btnAccept.setText("Accept");
                            btnDecline.setEnabled(true);
                        });
                    }
                }

                @Override
                public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                    runOnUiThread(() -> {
                        if (isFinishing() || isDestroyed()) return;
                        Toast.makeText(MainActivity.this, "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                        btnAccept.setEnabled(true);
                        btnAccept.setText("Accept");
                        btnDecline.setEnabled(true);
                    });
                }
            });
        }
    }

    private void declineDelivery() {
        if (currentOffer != null) {
            btnDecline.setEnabled(false);
            btnAccept.setEnabled(false);

            String orderId = currentOffer.getOrderId();

            socketManager.rejectDelivery(orderId, "Driver declined");

            apiService.rejectOrder(orderId).enqueue(new Callback<Map<String, Object>>() {
                @Override
                public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                    runOnUiThread(() -> {
                        if (isFinishing() || isDestroyed()) return;
                        hideDeliveryOffer();
                        Toast.makeText(MainActivity.this, "Delivery declined", Toast.LENGTH_SHORT).show();
                    });
                }

                @Override
                public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                    runOnUiThread(() -> {
                        if (isFinishing() || isDestroyed()) return;
                        hideDeliveryOffer();
                    });
                }
            });
        }
    }

    // ========================================================================
    // SocketManager.SocketListener callbacks
    // ========================================================================

    @Override
    public void onConnected() {
        runOnUiThread(() -> {
            tvStatus.setText("Online - Waiting for deliveries");
            updateOfflineMessage(true);
            socketManager.goOnline();
            updateConnectionStatus(true);
        });
    }

    @Override
    public void onDisconnected() {
        runOnUiThread(() -> {
            tvStatus.setText("Disconnected");
            updateOfflineMessage(false);
            switchOnline.setChecked(false);
            updateConnectionStatus(false);
        });
    }

    @Override
    public void onDeliveryOffer(DeliveryOffer offer) {
        showDeliveryOffer(offer);
    }

    @Override
    public void onDeliveryAccepted(String orderId) {
        runOnUiThread(() -> {
            hideDeliveryOffer();
            Toast.makeText(this, "Delivery accepted!", Toast.LENGTH_SHORT).show();

            Intent intent = new Intent(this, DeliveryActivity.class);
            intent.putExtra("orderId", orderId);
            if (currentOffer != null) {
                intent.putExtra("restaurantName", currentOffer.getRestaurantName());
                intent.putExtra("restaurantAddress", currentOffer.getRestaurantAddress());
                intent.putExtra("restaurantLat", currentOffer.getRestaurantLat());
                intent.putExtra("restaurantLng", currentOffer.getRestaurantLng());
                intent.putExtra("dropoffAddress", currentOffer.getDropoffAddress());
                intent.putExtra("dropoffLat", currentOffer.getDropoffLat());
                intent.putExtra("dropoffLng", currentOffer.getDropoffLng());
                intent.putExtra("customerName", currentOffer.getCustomerName());
                intent.putExtra("customerPhone", currentOffer.getCustomerPhone());
                intent.putExtra("deliveryFee", currentOffer.getTotalEarnings());
                intent.putExtra("tip", currentOffer.getTip());
                intent.putExtra("distanceToRestaurant", currentOffer.getDistanceToRestaurant());
                intent.putExtra("distanceToCustomer", currentOffer.getDistanceToCustomer());
            }
            startActivity(intent);
        });
    }

    @Override
    public void onDeliveryRejected(String orderId) {
        runOnUiThread(() -> {
            hideDeliveryOffer();
        });
    }

    @Override
    public void onError(String message) {
        runOnUiThread(() -> {
            Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
            btnAccept.setEnabled(true);
            btnAccept.setText("Accept");
        });
    }

    // ========================================================================
    // Lifecycle
    // ========================================================================

    @Override
    protected void onResume() {
        super.onResume();
        // Refresh earnings data when returning from another activity (e.g. after a delivery)
        // Only if the earnings tab is currently visible
        if (earningsContent != null && earningsContent.getVisibility() == View.VISIBLE) {
            fetchDailyFinances();
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (socketManager != null) {
            socketManager.removeListener(this);
        }
        if (offerTimer != null) {
            offerTimer.cancel();
        }
    }
}
