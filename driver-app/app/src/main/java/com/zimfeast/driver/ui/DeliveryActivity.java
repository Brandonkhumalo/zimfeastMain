package com.zimfeast.driver.ui;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.view.View;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import com.google.android.gms.maps.MapView;
import com.zimfeast.driver.R;
import com.zimfeast.driver.data.api.ApiClient;
import com.zimfeast.driver.data.api.ApiService;
import com.zimfeast.driver.data.model.StatusUpdateRequest;
import com.zimfeast.driver.service.LocationService;
import com.zimfeast.driver.socket.SocketManager;

import java.io.File;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.Map;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;
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
    private Button btnNavigate;
    private Button btnUpdateStatus;

    private SocketManager socketManager;
    private ApiService apiService;

    // In-app navigation
    private NavigationHelper navigationHelper;
    private FusedLocationProviderClient fusedLocationClient;
    private LocationCallback locationCallback;

    // Proof of delivery photo
    private Uri photoUri;
    private File photoFile;

    private final ActivityResultLauncher<Uri> takePhotoLauncher =
            registerForActivityResult(new ActivityResultContracts.TakePicture(), success -> {
                if (success && photoFile != null && photoFile.exists()) {
                    uploadDeliveryPhoto();
                } else {
                    Toast.makeText(this, "Photo capture cancelled. Completing delivery without photo.", Toast.LENGTH_SHORT).show();
                    completeDeliveryStatus();
                }
            });

    private final ActivityResultLauncher<String> cameraPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (granted) {
                    launchCamera();
                } else {
                    Toast.makeText(this, "Camera permission denied. Completing without photo.", Toast.LENGTH_SHORT).show();
                    completeDeliveryStatus();
                }
            });

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

        // Initialize in-app map navigation
        MapView mapView = findViewById(R.id.map_view);
        navigationHelper = new NavigationHelper(this, mapView, savedInstanceState);

        initViews();
        setupLocationUpdates();
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

        // Wire up map overlay views for ETA/distance display
        TextView tvEta = findViewById(R.id.tv_eta);
        TextView tvDistance = findViewById(R.id.tv_distance);
        View overlayEta = findViewById(R.id.overlay_eta);
        navigationHelper.setOverlayViews(tvEta, tvDistance, overlayEta);

        // Re-center map button
        findViewById(R.id.btn_recenter).setOnClickListener(v -> navigationHelper.recenterMap());

        btnNavigate.setOnClickListener(v -> openNavigation());
        btnUpdateStatus.setOnClickListener(v -> advanceStatus());

        // Set initial navigation destination (restaurant for pickup)
        updateNavigationDestination();
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

                Intent idleIntent = new Intent(this, LocationService.class);
                idleIntent.setAction(LocationService.ACTION_DELIVERY_IDLE);
                startService(idleIntent);

                Toast.makeText(this, "Delivery completed!", Toast.LENGTH_LONG).show();

                new android.os.Handler().postDelayed(this::finish, 2000);
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
                // Prompt for delivery proof photo before completing
                promptForDeliveryPhoto();
                return;
            default:
                return;
        }

        btnUpdateStatus.setEnabled(false);
        final String statusToSet = newStatus;
        updateStatusOnServer(statusToSet);
    }

    private void promptForDeliveryPhoto() {
        new AlertDialog.Builder(this)
                .setTitle("Proof of Delivery")
                .setMessage("Take a photo as proof of delivery?")
                .setPositiveButton("Take Photo", (d, w) -> {
                    if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                            == PackageManager.PERMISSION_GRANTED) {
                        launchCamera();
                    } else {
                        cameraPermissionLauncher.launch(Manifest.permission.CAMERA);
                    }
                })
                .setNegativeButton("Skip", (d, w) -> completeDeliveryStatus())
                .setCancelable(false)
                .show();
    }

    private void launchCamera() {
        try {
            String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
            String fileName = "delivery_" + orderId + "_" + timeStamp;
            File storageDir = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
            photoFile = File.createTempFile(fileName, ".jpg", storageDir);
            photoUri = FileProvider.getUriForFile(this,
                    getPackageName() + ".fileprovider", photoFile);
            takePhotoLauncher.launch(photoUri);
        } catch (IOException e) {
            Toast.makeText(this, "Failed to create photo file", Toast.LENGTH_SHORT).show();
            completeDeliveryStatus();
        }
    }

    private void uploadDeliveryPhoto() {
        btnUpdateStatus.setEnabled(false);
        btnUpdateStatus.setText("Uploading photo...");

        RequestBody requestFile = RequestBody.create(
                MediaType.parse("image/jpeg"), photoFile);
        MultipartBody.Part photoPart = MultipartBody.Part.createFormData(
                "photo", photoFile.getName(), requestFile);

        apiService.uploadDeliveryPhoto(orderId, photoPart).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    if (response.isSuccessful()) {
                        Toast.makeText(DeliveryActivity.this, "Photo uploaded", Toast.LENGTH_SHORT).show();
                    }
                    completeDeliveryStatus();
                });
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    Toast.makeText(DeliveryActivity.this, "Photo upload failed, completing delivery", Toast.LENGTH_SHORT).show();
                    completeDeliveryStatus();
                });
            }
        });
    }

    private void completeDeliveryStatus() {
        updateStatusOnServer("delivered");
    }

    private void updateStatusOnServer(String statusToSet) {
        btnUpdateStatus.setEnabled(false);

        socketManager.updateDeliveryStatus(orderId, statusToSet);

        StatusUpdateRequest statusRequest = new StatusUpdateRequest(statusToSet);
        apiService.updateOrderStatus(orderId, statusRequest).enqueue(new Callback<Map<String, Object>>() {
            @Override
            public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    if (response.isSuccessful()) {
                        currentStatus = statusToSet;
                        updateUI();
                        updateNavigationDestination();
                        Toast.makeText(DeliveryActivity.this, getStatusMessage(statusToSet), Toast.LENGTH_SHORT).show();
                    } else {
                        Toast.makeText(DeliveryActivity.this, "Failed to update status", Toast.LENGTH_SHORT).show();
                        btnUpdateStatus.setEnabled(true);
                    }
                });
            }

            @Override
            public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;
                    currentStatus = statusToSet;
                    updateUI();
                    Toast.makeText(DeliveryActivity.this, "Status updated locally", Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    private String getStatusMessage(String status) {
        switch (status) {
            case "arrived_restaurant": return "Arrived at restaurant";
            case "picked_up": return "Order picked up - heading to customer";
            case "out_for_delivery": return "On the way to customer";
            case "arrived_destination": return "Arrived at destination";
            case "delivered": return "Delivery completed!";
            default: return "Status updated";
        }
    }

    private void setupLocationUpdates() {
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        locationCallback = new LocationCallback() {
            @Override
            public void onLocationResult(LocationResult locationResult) {
                if (locationResult == null) return;
                android.location.Location loc = locationResult.getLastLocation();
                if (loc != null && navigationHelper != null) {
                    navigationHelper.updateDriverLocation(loc.getLatitude(), loc.getLongitude());
                }
            }
        };
        startLocationUpdates();
    }

    private void startLocationUpdates() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) return;
        LocationRequest request = new LocationRequest.Builder(
                Priority.PRIORITY_HIGH_ACCURACY, 10000)
                .setMinUpdateIntervalMillis(5000)
                .build();
        fusedLocationClient.requestLocationUpdates(request, locationCallback, getMainLooper());
    }

    private void updateNavigationDestination() {
        if (navigationHelper == null) return;
        if (currentStatus.equals("picked_up") || currentStatus.equals("out_for_delivery")
                || currentStatus.equals("arrived_destination")) {
            navigationHelper.setDestination(dropoffLat, dropoffLng, dropoffAddress);
        } else {
            navigationHelper.setDestination(restaurantLat, restaurantLng, "Pickup: " + restaurantName);
        }
    }

    private void openNavigation() {
        double lat, lng;
        if (currentStatus.equals("driver_assigned") || currentStatus.equals("arrived_restaurant")) {
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
    protected void onResume() {
        super.onResume();
        if (navigationHelper != null) navigationHelper.onResume();
    }

    @Override
    protected void onPause() {
        if (navigationHelper != null) navigationHelper.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (navigationHelper != null) navigationHelper.onDestroy();
        if (fusedLocationClient != null && locationCallback != null) {
            fusedLocationClient.removeLocationUpdates(locationCallback);
        }
        super.onDestroy();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (navigationHelper != null) navigationHelper.onSaveInstanceState(outState);
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
