package com.zimfeast.driver.ui;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.drawable.GradientDrawable;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
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
import com.zimfeast.driver.data.model.DeliveryOffer;
import com.zimfeast.driver.data.model.StatusUpdateRequest;
import com.zimfeast.driver.service.LocationService;
import com.zimfeast.driver.socket.SocketManager;

import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class MainActivity extends AppCompatActivity implements SocketManager.SocketListener {

    private static final int LOCATION_PERMISSION_REQUEST = 1001;

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

    private LinearLayout homeContent;
    private ScrollView earningsContent;
    private ScrollView settingsContent;
    private BottomNavigationView bottomNav;

    private TextView tvSettingsName;
    private TextView tvSettingsPhone;
    private TextView tvSettingsVehicle;
    private View viewConnectionIndicator;
    private TextView tvConnectionStatus;
    private Button btnLogout;

    private SocketManager socketManager;
    private ApiService apiService;
    private DeliveryOffer currentOffer;
    private android.os.CountDownTimer offerTimer;
    private static final int OFFER_TIMEOUT_SECONDS = 30;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

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
    }

    private void initViews() {
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

        homeContent = findViewById(R.id.home_content);
        earningsContent = findViewById(R.id.earnings_content);
        settingsContent = findViewById(R.id.settings_content);
        bottomNav = findViewById(R.id.bottom_nav);

        tvSettingsName = findViewById(R.id.tv_settings_name);
        tvSettingsPhone = findViewById(R.id.tv_settings_phone);
        tvSettingsVehicle = findViewById(R.id.tv_settings_vehicle);
        viewConnectionIndicator = findViewById(R.id.view_connection_indicator);
        tvConnectionStatus = findViewById(R.id.tv_connection_status);
        btnLogout = findViewById(R.id.btn_logout);

        tvOfflineMessage = findViewById(R.id.tv_offline_message);

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

    private void showEarnings() {
        homeContent.setVisibility(View.GONE);
        earningsContent.setVisibility(View.VISIBLE);
        settingsContent.setVisibility(View.GONE);
    }

    private void showSettings() {
        homeContent.setVisibility(View.GONE);
        earningsContent.setVisibility(View.GONE);
        settingsContent.setVisibility(View.VISIBLE);
        updateSettingsInfo();
    }

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
    }

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
                        hideDeliveryOffer();
                        Toast.makeText(MainActivity.this, "Offer expired - auto declined", Toast.LENGTH_SHORT).show();
                    });
                }

                @Override
                public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                    runOnUiThread(() -> {
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
                            if (offerTimer != null) {
                                offerTimer.cancel();
                            }
                        });
                    } else {
                        runOnUiThread(() -> {
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
                        hideDeliveryOffer();
                        Toast.makeText(MainActivity.this, "Delivery declined", Toast.LENGTH_SHORT).show();
                    });
                }

                @Override
                public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                    runOnUiThread(() -> {
                        hideDeliveryOffer();
                    });
                }
            });
        }
    }

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
