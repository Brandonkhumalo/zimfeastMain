package com.zimfeast.customer.ui.address;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Address;
import android.location.Geocoder;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextWatcher;
import android.util.Log;
import android.view.View;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.SupportMapFragment;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.libraries.places.api.Places;
import com.google.android.libraries.places.api.model.AutocompletePrediction;
import com.google.android.libraries.places.api.model.Place;
import com.google.android.libraries.places.api.model.RectangularBounds;
import com.google.android.libraries.places.api.net.FetchPlaceRequest;
import com.google.android.libraries.places.api.net.FindAutocompletePredictionsRequest;
import com.google.android.libraries.places.api.net.PlacesClient;
import com.zimfeast.customer.R;
import com.zimfeast.customer.databinding.ActivityAddressPickerBinding;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Executors;

public class AddressPickerActivity extends AppCompatActivity implements 
        OnMapReadyCallback, 
        AddressSuggestionAdapter.OnSuggestionClickListener {

    private static final String TAG = "AddressPicker";
    public static final String EXTRA_LATITUDE = "latitude";
    public static final String EXTRA_LONGITUDE = "longitude";
    public static final String EXTRA_ADDRESS = "address";
    
    private static final int LOCATION_PERMISSION_REQUEST = 100;
    private static final LatLng HARARE_CENTER = new LatLng(-17.8292, 31.0522);

    private ActivityAddressPickerBinding binding;
    private PlacesClient placesClient;
    private GoogleMap googleMap;
    private FusedLocationProviderClient fusedLocationClient;
    private AddressSuggestionAdapter suggestionAdapter;
    
    private Handler searchHandler = new Handler(Looper.getMainLooper());
    private Runnable searchRunnable;
    
    private LatLng selectedLatLng;
    private String selectedAddress;
    private boolean isMapReady = false;
    private boolean isDragging = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityAddressPickerBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        initializePlaces();
        setupViews();
        setupMap();
    }

    private void initializePlaces() {
        if (!Places.isInitialized()) {
            String apiKey = getGoogleMapsApiKey();
            if (apiKey != null && !apiKey.isEmpty()) {
                Places.initialize(getApplicationContext(), apiKey);
            }
        }
        placesClient = Places.createClient(this);
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
    }

    private String getGoogleMapsApiKey() {
        try {
            android.content.pm.ApplicationInfo ai = getPackageManager()
                    .getApplicationInfo(getPackageName(), PackageManager.GET_META_DATA);
            Bundle bundle = ai.metaData;
            return bundle.getString("com.google.android.geo.API_KEY");
        } catch (Exception e) {
            Log.e(TAG, "Failed to get API key", e);
            return null;
        }
    }

    private void setupViews() {
        binding.toolbar.setNavigationOnClickListener(v -> finish());

        suggestionAdapter = new AddressSuggestionAdapter(this);
        binding.rvSuggestions.setLayoutManager(new LinearLayoutManager(this));
        binding.rvSuggestions.setAdapter(suggestionAdapter);

        binding.etSearchAddress.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                binding.ivClear.setVisibility(s.length() > 0 ? View.VISIBLE : View.GONE);
                
                if (searchRunnable != null) {
                    searchHandler.removeCallbacks(searchRunnable);
                }
                
                searchRunnable = () -> searchPlaces(s.toString());
                searchHandler.postDelayed(searchRunnable, 300);
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });

        binding.ivClear.setOnClickListener(v -> {
            binding.etSearchAddress.setText("");
            hideSuggestions();
        });

        binding.tvCurrentLocation.setOnClickListener(v -> getCurrentLocation());

        binding.btnConfirmAddress.setOnClickListener(v -> confirmAddress());
    }

    private void setupMap() {
        SupportMapFragment mapFragment = (SupportMapFragment) getSupportFragmentManager()
                .findFragmentById(R.id.mapFragment);
        if (mapFragment != null) {
            mapFragment.getMapAsync(this);
        }
    }

    @Override
    public void onMapReady(@NonNull GoogleMap map) {
        googleMap = map;
        isMapReady = true;

        googleMap.getUiSettings().setZoomControlsEnabled(true);
        googleMap.getUiSettings().setMyLocationButtonEnabled(false);
        googleMap.getUiSettings().setCompassEnabled(true);

        googleMap.moveCamera(CameraUpdateFactory.newLatLngZoom(HARARE_CENTER, 12f));

        googleMap.setOnCameraIdleListener(() -> {
            if (isDragging) {
                isDragging = false;
                LatLng center = googleMap.getCameraPosition().target;
                updateSelectedLocation(center);
            }
        });

        googleMap.setOnCameraMoveStartedListener(reason -> {
            if (reason == GoogleMap.OnCameraMoveStartedListener.REASON_GESTURE) {
                isDragging = true;
            }
        });

        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) 
                == PackageManager.PERMISSION_GRANTED) {
            googleMap.setMyLocationEnabled(true);
        }
    }

    private void searchPlaces(String query) {
        if (query.isEmpty()) {
            hideSuggestions();
            return;
        }

        RectangularBounds bounds = RectangularBounds.newInstance(
                new LatLng(-18.5, 30.0),
                new LatLng(-17.0, 32.5)
        );

        FindAutocompletePredictionsRequest request = FindAutocompletePredictionsRequest.builder()
                .setQuery(query)
                .setLocationBias(bounds)
                .setCountries("ZW")
                .build();

        placesClient.findAutocompletePredictions(request)
                .addOnSuccessListener(response -> {
                    List<AutocompletePrediction> predictions = response.getAutocompletePredictions();
                    suggestionAdapter.updateSuggestions(predictions);
                    showSuggestions(!predictions.isEmpty());
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "Place prediction failed", e);
                    hideSuggestions();
                });
    }

    @Override
    public void onSuggestionClick(AutocompletePrediction prediction) {
        binding.etSearchAddress.setText(prediction.getPrimaryText(null));
        hideSuggestions();
        
        binding.progressBar.setVisibility(View.VISIBLE);

        List<Place.Field> placeFields = Arrays.asList(Place.Field.ID, Place.Field.LAT_LNG, Place.Field.ADDRESS);
        FetchPlaceRequest request = FetchPlaceRequest.newInstance(prediction.getPlaceId(), placeFields);

        placesClient.fetchPlace(request)
                .addOnSuccessListener(response -> {
                    binding.progressBar.setVisibility(View.GONE);
                    Place place = response.getPlace();
                    if (place.getLatLng() != null) {
                        moveToLocation(place.getLatLng(), place.getAddress());
                    }
                })
                .addOnFailureListener(e -> {
                    binding.progressBar.setVisibility(View.GONE);
                    Log.e(TAG, "Place fetch failed", e);
                });
    }

    private void getCurrentLocation() {
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) 
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.ACCESS_FINE_LOCATION},
                    LOCATION_PERMISSION_REQUEST);
            return;
        }

        binding.progressBar.setVisibility(View.VISIBLE);
        
        fusedLocationClient.getLastLocation()
                .addOnSuccessListener(location -> {
                    binding.progressBar.setVisibility(View.GONE);
                    if (location != null) {
                        LatLng latLng = new LatLng(location.getLatitude(), location.getLongitude());
                        moveToLocation(latLng, null);
                    }
                })
                .addOnFailureListener(e -> {
                    binding.progressBar.setVisibility(View.GONE);
                    Log.e(TAG, "Failed to get location", e);
                });
    }

    private void moveToLocation(LatLng latLng, String address) {
        if (!isMapReady || googleMap == null) return;

        selectedLatLng = latLng;
        
        googleMap.animateCamera(CameraUpdateFactory.newLatLngZoom(latLng, 17f));
        
        binding.ivCenterMarker.setVisibility(View.VISIBLE);
        binding.cardSelectedAddress.setVisibility(View.VISIBLE);

        if (address != null && !address.isEmpty()) {
            selectedAddress = address;
            binding.tvSelectedAddress.setText(address);
        } else {
            reverseGeocode(latLng);
        }
    }

    private void updateSelectedLocation(LatLng latLng) {
        selectedLatLng = latLng;
        reverseGeocode(latLng);
    }

    private void reverseGeocode(LatLng latLng) {
        Executors.newSingleThreadExecutor().execute(() -> {
            try {
                Geocoder geocoder = new Geocoder(this, Locale.getDefault());
                List<Address> addresses = geocoder.getFromLocation(
                        latLng.latitude, latLng.longitude, 1);
                
                if (addresses != null && !addresses.isEmpty()) {
                    Address addr = addresses.get(0);
                    StringBuilder sb = new StringBuilder();
                    
                    if (addr.getSubThoroughfare() != null) {
                        sb.append(addr.getSubThoroughfare()).append(" ");
                    }
                    if (addr.getThoroughfare() != null) {
                        sb.append(addr.getThoroughfare());
                    }
                    if (addr.getLocality() != null) {
                        if (sb.length() > 0) sb.append(", ");
                        sb.append(addr.getLocality());
                    }
                    if (addr.getSubAdminArea() != null) {
                        if (sb.length() > 0) sb.append(", ");
                        sb.append(addr.getSubAdminArea());
                    }
                    
                    String addressText = sb.length() > 0 ? sb.toString() : addr.getAddressLine(0);
                    
                    runOnUiThread(() -> {
                        selectedAddress = addressText;
                        binding.tvSelectedAddress.setText(addressText);
                    });
                }
            } catch (IOException e) {
                Log.e(TAG, "Geocoding failed", e);
                runOnUiThread(() -> {
                    selectedAddress = String.format(Locale.US, "%.6f, %.6f", latLng.latitude, latLng.longitude);
                    binding.tvSelectedAddress.setText(selectedAddress);
                });
            }
        });
    }

    private void showSuggestions(boolean show) {
        binding.rvSuggestions.setVisibility(show ? View.VISIBLE : View.GONE);
        binding.divider.setVisibility(show ? View.VISIBLE : View.GONE);
    }

    private void hideSuggestions() {
        suggestionAdapter.updateSuggestions(null);
        showSuggestions(false);
    }

    private void confirmAddress() {
        if (selectedLatLng == null) return;

        Intent resultIntent = new Intent();
        resultIntent.putExtra(EXTRA_LATITUDE, selectedLatLng.latitude);
        resultIntent.putExtra(EXTRA_LONGITUDE, selectedLatLng.longitude);
        resultIntent.putExtra(EXTRA_ADDRESS, selectedAddress != null ? selectedAddress : "");
        
        setResult(RESULT_OK, resultIntent);
        finish();
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, 
            @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == LOCATION_PERMISSION_REQUEST) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                getCurrentLocation();
                if (googleMap != null) {
                    if (ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) 
                            == PackageManager.PERMISSION_GRANTED) {
                        googleMap.setMyLocationEnabled(true);
                    }
                }
            }
        }
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (searchHandler != null && searchRunnable != null) {
            searchHandler.removeCallbacks(searchRunnable);
        }
    }
}
