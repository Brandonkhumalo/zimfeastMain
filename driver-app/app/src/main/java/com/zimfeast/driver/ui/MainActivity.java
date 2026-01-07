package com.zimfeast.driver.ui;

import android.Manifest;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.cardview.widget.CardView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.google.android.material.switchmaterial.SwitchMaterial;
import com.zimfeast.driver.R;
import com.zimfeast.driver.ZimFeastDriverApp;
import com.zimfeast.driver.data.model.DeliveryOffer;
import com.zimfeast.driver.service.LocationService;
import com.zimfeast.driver.socket.SocketManager;

public class MainActivity extends AppCompatActivity implements SocketManager.SocketListener {
    
    private static final int LOCATION_PERMISSION_REQUEST = 1001;
    
    private SwitchMaterial switchOnline;
    private TextView tvStatus;
    private TextView tvDriverName;
    private CardView cardDeliveryOffer;
    private TextView tvOfferRestaurant;
    private TextView tvOfferAddress;
    private TextView tvOfferDistance;
    private TextView tvOfferEarnings;
    private TextView tvOfferTimer;
    private Button btnAccept;
    private Button btnDecline;
    
    private SocketManager socketManager;
    private DeliveryOffer currentOffer;
    private android.os.CountDownTimer offerTimer;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        if (ZimFeastDriverApp.getInstance().getDriverId() == null) {
            startActivity(new Intent(this, LoginActivity.class));
            finish();
            return;
        }
        
        initViews();
        setupListeners();
        
        socketManager = SocketManager.getInstance();
        socketManager.addListener(this);
        
        checkLocationPermission();
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
        
        tvDriverName.setText(ZimFeastDriverApp.getInstance().getDriverName());
        cardDeliveryOffer.setVisibility(View.GONE);
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
        socketManager.connect();
        
        Intent serviceIntent = new Intent(this, LocationService.class);
        ContextCompat.startForegroundService(this, serviceIntent);
        
        ZimFeastDriverApp.getInstance().setOnline(true);
    }
    
    private void goOffline() {
        tvStatus.setText("Offline");
        socketManager.goOffline();
        socketManager.disconnect();
        
        Intent serviceIntent = new Intent(this, LocationService.class);
        stopService(serviceIntent);
        
        ZimFeastDriverApp.getInstance().setOnline(false);
        hideDeliveryOffer();
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
        
        offerTimer = new android.os.CountDownTimer(seconds * 1000L, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                int secondsLeft = (int) (millisUntilFinished / 1000);
                tvOfferTimer.setText(secondsLeft + "s");
            }
            
            @Override
            public void onFinish() {
                hideDeliveryOffer();
                Toast.makeText(MainActivity.this, "Offer expired", Toast.LENGTH_SHORT).show();
            }
        }.start();
    }
    
    private void acceptDelivery() {
        if (currentOffer != null) {
            socketManager.acceptDelivery(currentOffer.getOrderId());
            btnAccept.setEnabled(false);
            btnAccept.setText("Accepting...");
        }
    }
    
    private void declineDelivery() {
        if (currentOffer != null) {
            socketManager.rejectDelivery(currentOffer.getOrderId(), "Driver declined");
            hideDeliveryOffer();
        }
    }
    
    @Override
    public void onConnected() {
        runOnUiThread(() -> {
            tvStatus.setText("Online - Waiting for deliveries");
            socketManager.goOnline();
        });
    }
    
    @Override
    public void onDisconnected() {
        runOnUiThread(() -> {
            tvStatus.setText("Disconnected");
            switchOnline.setChecked(false);
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
                intent.putExtra("restaurantLat", currentOffer.getRestaurantLat());
                intent.putExtra("restaurantLng", currentOffer.getRestaurantLng());
                intent.putExtra("dropoffAddress", currentOffer.getDropoffAddress());
                intent.putExtra("dropoffLat", currentOffer.getDropoffLat());
                intent.putExtra("dropoffLng", currentOffer.getDropoffLng());
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
        socketManager.removeListener(this);
        if (offerTimer != null) {
            offerTimer.cancel();
        }
    }
}
