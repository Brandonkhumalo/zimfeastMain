package com.zimfeast.customer.ui.tracking;

import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;

import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.MapView;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.model.BitmapDescriptor;
import com.google.android.gms.maps.model.BitmapDescriptorFactory;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.LatLngBounds;
import com.google.android.gms.maps.model.Marker;
import com.google.android.gms.maps.model.MarkerOptions;
import com.google.android.gms.maps.model.Polyline;
import com.google.android.gms.maps.model.PolylineOptions;

import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.model.Order;
import com.zimfeast.customer.databinding.ActivityOrderTrackingBinding;
import com.zimfeast.customer.socket.TrackingSocketManager;
import com.zimfeast.customer.ui.customer.CustomerActivity;
import com.zimfeast.customer.ui.rating.RatingDialog;

import java.util.Arrays;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * OrderTrackingActivity shows the order status timeline and a live Google Map
 * that tracks the driver's position in real-time via Socket.IO.
 *
 * The map card is shown when the order status is "assigned" or "out_for_delivery".
 * Three markers are displayed:
 * - Blue:  Driver (updates in real-time from socket)
 * - Green: Restaurant (origin)
 * - Red:   Customer delivery location (destination)
 *
 * A polyline connects restaurant to delivery location as the route.
 */
public class OrderTrackingActivity extends AppCompatActivity implements
        OnMapReadyCallback, TrackingSocketManager.TrackingListener {

    private static final String TAG = "OrderTrackingActivity";

    private ActivityOrderTrackingBinding binding;
    private String orderId;
    private Order currentOrder;
    private Handler handler;
    private Runnable pollRunnable;
    private static final long POLL_INTERVAL_BASE = 15000;
    private static final long POLL_INTERVAL_MAX = 120000; // Cap at 2 minutes
    private long currentPollInterval = POLL_INTERVAL_BASE;
    private int consecutiveFailures = 0;

    // Tracks the previous status so we can detect transitions to "delivered"
    private String previousStatus = null;
    // Prevents showing the rating dialog more than once per activity session
    private boolean ratingDialogShown = false;

    // ---- Map components ----
    private MapView mapView;
    private GoogleMap googleMap;
    private Marker driverMarker;
    private Marker restaurantMarker;
    private Marker deliveryMarker;
    private Polyline routePolyline;
    private boolean mapReady = false;

    // Coordinates — populated from intent extras and/or order response
    private double restaurantLat = 0;
    private double restaurantLng = 0;
    private double deliveryLat = 0;
    private double deliveryLng = 0;
    private double driverLat = 0;
    private double driverLng = 0;

    // Socket manager for live driver updates
    private TrackingSocketManager socketManager;

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

        // Read restaurant and delivery coordinates from intent extras (if available)
        restaurantLat = getIntent().getDoubleExtra("restaurantLat", 0);
        restaurantLng = getIntent().getDoubleExtra("restaurantLng", 0);
        deliveryLat = getIntent().getDoubleExtra("deliveryLat", 0);
        deliveryLng = getIntent().getDoubleExtra("deliveryLng", 0);

        handler = new Handler(Looper.getMainLooper());

        // Initialize the MapView (it lives inside card_map which starts GONE)
        mapView = binding.mapView;
        mapView.onCreate(savedInstanceState);
        mapView.getMapAsync(this);

        // Set up socket manager for real-time driver tracking
        socketManager = TrackingSocketManager.getInstance();
        socketManager.addListener(this);
        socketManager.connect();

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
            if (currentOrder != null && currentOrder.getDriver() != null
                    && currentOrder.getDriver().getPhone() != null) {
                Intent intent = new Intent(Intent.ACTION_DIAL);
                intent.setData(Uri.parse("tel:" + currentOrder.getDriver().getPhone()));
                startActivity(intent);
            }
        });
    }

    // =========================================================================
    // Google Map
    // =========================================================================

    @Override
    public void onMapReady(GoogleMap map) {
        googleMap = map;
        mapReady = true;

        // Configure map UI
        googleMap.getUiSettings().setZoomControlsEnabled(true);
        googleMap.getUiSettings().setMapToolbarEnabled(false);

        // Place initial markers if we already have coordinates
        updateMapMarkers();

        Log.d(TAG, "Map is ready");
    }

    /**
     * Places or updates the three markers (driver, restaurant, delivery) on the map,
     * draws a polyline route from restaurant to delivery, and fits the camera.
     */
    private void updateMapMarkers() {
        if (!mapReady || googleMap == null) return;

        runOnUiThread(() -> {
            LatLngBounds.Builder boundsBuilder = new LatLngBounds.Builder();
            boolean hasPoints = false;

            // --- Restaurant marker (green) ---
            if (restaurantLat != 0 && restaurantLng != 0) {
                LatLng pos = new LatLng(restaurantLat, restaurantLng);
                if (restaurantMarker == null) {
                    restaurantMarker = googleMap.addMarker(new MarkerOptions()
                            .position(pos)
                            .title("Restaurant")
                            .icon(createCircleMarker(
                                    ContextCompat.getColor(this, R.color.success))));
                } else {
                    restaurantMarker.setPosition(pos);
                }
                boundsBuilder.include(pos);
                hasPoints = true;
            }

            // --- Delivery marker (red) ---
            if (deliveryLat != 0 && deliveryLng != 0) {
                LatLng pos = new LatLng(deliveryLat, deliveryLng);
                if (deliveryMarker == null) {
                    deliveryMarker = googleMap.addMarker(new MarkerOptions()
                            .position(pos)
                            .title("Your Location")
                            .icon(createCircleMarker(
                                    ContextCompat.getColor(this, R.color.error))));
                } else {
                    deliveryMarker.setPosition(pos);
                }
                boundsBuilder.include(pos);
                hasPoints = true;
            }

            // --- Driver marker (blue) ---
            if (driverLat != 0 && driverLng != 0) {
                LatLng pos = new LatLng(driverLat, driverLng);
                if (driverMarker == null) {
                    driverMarker = googleMap.addMarker(new MarkerOptions()
                            .position(pos)
                            .title("Driver")
                            .icon(createCircleMarker(
                                    ContextCompat.getColor(this, R.color.link)))
                            .zIndex(10f)); // Driver always on top
                } else {
                    driverMarker.setPosition(pos);
                }
                boundsBuilder.include(pos);
                hasPoints = true;
            }

            // --- Route polyline from restaurant to delivery (draw once) ---
            if (restaurantLat != 0 && restaurantLng != 0
                    && deliveryLat != 0 && deliveryLng != 0
                    && routePolyline == null) {
                LatLng origin = new LatLng(restaurantLat, restaurantLng);
                LatLng destination = new LatLng(deliveryLat, deliveryLng);
                routePolyline = googleMap.addPolyline(new PolylineOptions()
                        .add(origin, destination)
                        .width(8f)
                        .color(ContextCompat.getColor(this, R.color.link))
                        .geodesic(true));
            }

            // --- Fit camera to show all markers ---
            if (hasPoints) {
                try {
                    LatLngBounds bounds = boundsBuilder.build();
                    googleMap.animateCamera(
                            CameraUpdateFactory.newLatLngBounds(bounds, 80));
                } catch (Exception e) {
                    Log.w(TAG, "Could not fit bounds: " + e.getMessage());
                }
            }
        });
    }

    /**
     * Creates a simple colored circle BitmapDescriptor for map markers.
     * A white border ring surrounds a colored inner circle.
     */
    private BitmapDescriptor createCircleMarker(int color) {
        int size = 48; // px
        Bitmap bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        // Outer circle (white border)
        Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        borderPaint.setColor(0xFFFFFFFF);
        borderPaint.setStyle(Paint.Style.FILL);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f, borderPaint);

        // Inner circle (colored fill)
        Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        fillPaint.setColor(color);
        fillPaint.setStyle(Paint.Style.FILL);
        canvas.drawCircle(size / 2f, size / 2f, size / 2f - 4f, fillPaint);

        return BitmapDescriptorFactory.fromBitmap(bitmap);
    }

    // =========================================================================
    // TrackingSocketManager.TrackingListener — real-time callbacks
    // =========================================================================

    @Override
    public void onDriverAssigned(String driverId, String name, String phone,
                                  String vehicle, double lat, double lng) {
        runOnUiThread(() -> {
            // Show driver info card
            binding.layoutDriver.setVisibility(View.VISIBLE);
            binding.tvDriverName.setText(name);
            binding.tvDriverVehicle.setText(vehicle);

            // Update driver position on map
            driverLat = lat;
            driverLng = lng;
            showMapCard();
            updateMapMarkers();

            updateStatusTimeline("assigned");
        });
    }

    @Override
    public void onDriverLocation(double lat, double lng) {
        runOnUiThread(() -> {
            driverLat = lat;
            driverLng = lng;
            updateMapMarkers();
        });
    }

    @Override
    public void onOrderStatus(String status) {
        runOnUiThread(() -> {
            updateStatusTimeline(status);

            // Show/hide map card based on status
            List<String> mapStatuses = Arrays.asList("assigned", "out_for_delivery");
            if (mapStatuses.contains(status)) {
                showMapCard();
            }

            // Terminal states: stop polling, hide map, possibly show rating
            List<String> terminalStatuses = Arrays.asList("delivered", "cancelled", "collected");
            if (terminalStatuses.contains(status)) {
                stopPolling();
                hideMapCard();
            }

            // Show rating dialog on delivery
            if ("delivered".equals(status) && !"delivered".equals(previousStatus) && !ratingDialogShown) {
                ratingDialogShown = true;
                showRatingDialog();
            }
            previousStatus = status;
        });
    }

    @Override
    public void onETA(int minutes, String distance) {
        runOnUiThread(() -> {
            String etaText = "ETA: " + minutes + " min";
            if (distance != null && !distance.isEmpty()) {
                etaText += " (" + distance + ")";
            }
            binding.tvEta.setText(etaText);
        });
    }

    @Override
    public void onDeliveryCompleted(boolean requestRating) {
        runOnUiThread(() -> {
            updateStatusTimeline("delivered");
            hideMapCard();
            stopPolling();

            if (requestRating && !ratingDialogShown) {
                ratingDialogShown = true;
                showRatingDialog();
            }
        });
    }

    @Override
    public void onNoDriversAvailable() {
        runOnUiThread(() ->
                Toast.makeText(this, "Looking for nearby drivers...", Toast.LENGTH_SHORT).show()
        );
    }

    // =========================================================================
    // Map card visibility helpers
    // =========================================================================

    private void showMapCard() {
        if (binding.cardMap.getVisibility() != View.VISIBLE) {
            binding.cardMap.setVisibility(View.VISIBLE);
        }
    }

    private void hideMapCard() {
        binding.cardMap.setVisibility(View.GONE);
    }

    // =========================================================================
    // REST API polling (fallback when socket is unavailable)
    // =========================================================================

    private void loadOrderStatus() {
        ApiClient.getInstance().getApiService().getOrderStatus(orderId).enqueue(new Callback<Order>() {
            @Override
            public void onResponse(Call<Order> call, Response<Order> response) {
                if (isFinishing() || isDestroyed()) return;
                if (response.isSuccessful() && response.body() != null) {
                    currentOrder = response.body();
                    updateUI();

                    // Subscribe to socket updates for this order
                    if (socketManager.isConnected()) {
                        socketManager.subscribeToOrder(orderId, "");
                    }

                    // Reset backoff on success
                    consecutiveFailures = 0;
                    currentPollInterval = POLL_INTERVAL_BASE;

                    // Stop polling if order is in terminal state
                    String status = currentOrder.getStatus();
                    if ("delivered".equals(status) || "cancelled".equals(status) || "collected".equals(status)) {
                        stopPolling();
                    }

                    // Show rating dialog when order transitions to "delivered"
                    if ("delivered".equals(status) && !"delivered".equals(previousStatus) && !ratingDialogShown) {
                        ratingDialogShown = true;
                        showRatingDialog();
                    }
                    previousStatus = status;
                }
            }

            @Override
            public void onFailure(Call<Order> call, Throwable t) {
                if (isFinishing() || isDestroyed()) return;
                consecutiveFailures++;
                long backoff = Math.min(
                        POLL_INTERVAL_BASE * (1L << Math.min(consecutiveFailures, 6)),
                        POLL_INTERVAL_MAX
                );
                currentPollInterval = backoff + (long) (Math.random() * backoff * 0.25);
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

        // Update delivery coordinates from order if we don't already have them
        if (currentOrder.getDeliveryCoordinates() != null) {
            if (deliveryLat == 0) deliveryLat = currentOrder.getDeliveryCoordinates().getLat();
            if (deliveryLng == 0) deliveryLng = currentOrder.getDeliveryCoordinates().getLng();
        }

        // Show driver info
        if (currentOrder.getDriver() != null) {
            binding.layoutDriver.setVisibility(View.VISIBLE);
            binding.tvDriverName.setText(currentOrder.getDriver().getName());
            binding.tvDriverVehicle.setText(currentOrder.getDriver().getVehicle());

            // Get driver coordinates if available from REST response
            if (currentOrder.getDriver().getCoordinates() != null) {
                driverLat = currentOrder.getDriver().getCoordinates().getLat();
                driverLng = currentOrder.getDriver().getCoordinates().getLng();
            }
        } else {
            binding.layoutDriver.setVisibility(View.GONE);
        }

        // Show map when order is assigned or out for delivery
        List<String> mapStatuses = Arrays.asList("assigned", "out_for_delivery");
        if (mapStatuses.contains(status)) {
            showMapCard();
            updateMapMarkers();
        } else {
            hideMapCard();
        }
    }

    private void displayMockStatus() {
        updateStatusTimeline("out_for_delivery");

        binding.layoutDriver.setVisibility(View.VISIBLE);
        binding.tvDriverName.setText("John Mukamuri");
        binding.tvDriverVehicle.setText("Toyota Vitz - ABC 123 GP");
    }

    private void updateStatusTimeline(String status) {
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

    /**
     * Shows the RatingDialog after the order has been delivered.
     */
    private void showRatingDialog() {
        if (currentOrder == null) return;

        String restaurantId = currentOrder.getRestaurantId() != null ? currentOrder.getRestaurantId() : "";
        String restaurantName = currentOrder.getRestaurantName() != null ? currentOrder.getRestaurantName() : "Restaurant";
        String driverName = "";
        String driverId = "";
        if (currentOrder.getDriver() != null) {
            driverName = currentOrder.getDriver().getName() != null ? currentOrder.getDriver().getName() : "";
        }

        RatingDialog dialog = RatingDialog.newInstance(
                orderId, restaurantId, restaurantName, driverName, driverId
        );
        dialog.show(getSupportFragmentManager(), "rating_dialog");
    }

    // =========================================================================
    // Polling
    // =========================================================================

    private void startPolling() {
        pollRunnable = new Runnable() {
            @Override
            public void run() {
                loadOrderStatus();
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

    // =========================================================================
    // Lifecycle — forward to MapView
    // =========================================================================

    @Override
    protected void onResume() {
        super.onResume();
        if (mapView != null) mapView.onResume();

        // Re-subscribe on resume
        if (socketManager != null && orderId != null) {
            socketManager.connect();
            socketManager.subscribeToOrder(orderId, "");
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (mapView != null) mapView.onPause();
    }

    @Override
    protected void onStart() {
        super.onStart();
        if (mapView != null) mapView.onStart();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (mapView != null) mapView.onStop();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (mapView != null) mapView.onSaveInstanceState(outState);
    }

    @Override
    public void onLowMemory() {
        super.onLowMemory();
        if (mapView != null) mapView.onLowMemory();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        stopPolling();

        // Clean up socket listener
        if (socketManager != null) {
            socketManager.removeListener(this);
            if (orderId != null) {
                socketManager.unsubscribeFromOrder(orderId);
            }
        }

        if (mapView != null) mapView.onDestroy();
    }
}
