package com.zimfeast.customer.ui.address;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.local.AppDatabase;
import com.zimfeast.customer.data.model.Address;
import com.zimfeast.customer.databinding.ActivityAddressBookBinding;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Displays the user's saved addresses with add/edit/delete capabilities.
 * Addresses are fetched from the API and cached locally via Room for offline
 * access. When launched from the cart/checkout flow with EXTRA_SELECT_MODE
 * set to true, tapping an address returns it to the caller via setResult().
 */
public class AddressBookActivity extends AppCompatActivity
        implements AddressBookAdapter.OnAddressActionListener {

    public static final String EXTRA_SELECT_MODE = "select_mode";
    public static final String EXTRA_SELECTED_ADDRESS_ID = "selected_address_id";
    public static final String EXTRA_SELECTED_LAT = "selected_lat";
    public static final String EXTRA_SELECTED_LNG = "selected_lng";
    public static final String EXTRA_SELECTED_ADDRESS_TEXT = "selected_address_text";
    public static final String EXTRA_SELECTED_LABEL = "selected_label";

    private ActivityAddressBookBinding binding;
    private AddressBookAdapter adapter;
    private boolean selectMode = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityAddressBookBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        selectMode = getIntent().getBooleanExtra(EXTRA_SELECT_MODE, false);

        setupViews();
        loadCachedAddresses();
        fetchAddressesFromApi();
    }

    private void setupViews() {
        binding.btnBack.setOnClickListener(v -> finish());

        adapter = new AddressBookAdapter(new ArrayList<>(), this, selectMode);
        binding.rvAddresses.setLayoutManager(new LinearLayoutManager(this));
        binding.rvAddresses.setAdapter(adapter);

        binding.fabAddAddress.setOnClickListener(v -> showAddEditDialog(null));
    }

    /** Show cached addresses immediately for a fast UI experience. */
    private void loadCachedAddresses() {
        AppDatabase.getInstance(this).addressDao().getAllAddresses().observe(this, addresses -> {
            if (addresses != null && !addresses.isEmpty()) {
                adapter.updateData(addresses);
                showEmpty(false);
            }
        });
    }

    /** Fetch fresh addresses from the server and update the local cache. */
    private void fetchAddressesFromApi() {
        binding.progressBar.setVisibility(View.VISIBLE);

        ApiClient.getInstance().getApiService().getAddresses().enqueue(new Callback<List<Address>>() {
            @Override
            public void onResponse(Call<List<Address>> call, Response<List<Address>> response) {
                if (isFinishing() || isDestroyed()) return;
                binding.progressBar.setVisibility(View.GONE);

                if (response.isSuccessful() && response.body() != null) {
                    List<Address> addresses = response.body();
                    adapter.updateData(addresses);
                    showEmpty(addresses.isEmpty());

                    // Cache in Room for offline access
                    Executors.newSingleThreadExecutor().execute(() -> {
                        AppDatabase db = AppDatabase.getInstance(AddressBookActivity.this);
                        db.addressDao().clearAll();
                        db.addressDao().insertAll(addresses);
                    });
                } else {
                    showEmpty(adapter.getItemCount() == 0);
                }
            }

            @Override
            public void onFailure(Call<List<Address>> call, Throwable t) {
                if (isFinishing() || isDestroyed()) return;
                binding.progressBar.setVisibility(View.GONE);
                showEmpty(adapter.getItemCount() == 0);
                Toast.makeText(AddressBookActivity.this,
                        getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void showEmpty(boolean empty) {
        binding.layoutEmpty.setVisibility(empty ? View.VISIBLE : View.GONE);
        binding.rvAddresses.setVisibility(empty ? View.GONE : View.VISIBLE);
    }

    // ── Adapter callbacks ─────────────────────────────────────────────

    @Override
    public void onAddressClick(Address address) {
        if (selectMode) {
            // Return selected address to calling activity
            Intent result = new Intent();
            result.putExtra(EXTRA_SELECTED_ADDRESS_ID, address.getId());
            result.putExtra(EXTRA_SELECTED_LAT, address.getLat());
            result.putExtra(EXTRA_SELECTED_LNG, address.getLng());
            result.putExtra(EXTRA_SELECTED_ADDRESS_TEXT, address.getAddressText());
            result.putExtra(EXTRA_SELECTED_LABEL, address.getLabel());
            setResult(RESULT_OK, result);
            finish();
        }
    }

    @Override
    public void onEditClick(Address address) {
        showAddEditDialog(address);
    }

    @Override
    public void onDeleteClick(Address address) {
        new MaterialAlertDialogBuilder(this)
                .setTitle("Delete Address")
                .setMessage("Remove \"" + address.getLabel() + "\"?")
                .setPositiveButton("Delete", (dialog, which) -> deleteAddress(address))
                .setNegativeButton("Cancel", null)
                .show();
    }

    // ── Add / Edit dialog ─────────────────────────────────────────────

    private void showAddEditDialog(Address existing) {
        View dialogView = LayoutInflater.from(this)
                .inflate(R.layout.dialog_add_address, null);

        EditText etLabel = dialogView.findViewById(R.id.et_label);
        EditText etAddressText = dialogView.findViewById(R.id.et_address_text);
        EditText etLat = dialogView.findViewById(R.id.et_lat);
        EditText etLng = dialogView.findViewById(R.id.et_lng);

        if (existing != null) {
            etLabel.setText(existing.getLabel());
            etAddressText.setText(existing.getAddressText());
            etLat.setText(String.valueOf(existing.getLat()));
            etLng.setText(String.valueOf(existing.getLng()));
        }

        // "Use Current Location" button
        dialogView.findViewById(R.id.btn_use_current_location).setOnClickListener(v -> {
            if (androidx.core.app.ActivityCompat.checkSelfPermission(this,
                    android.Manifest.permission.ACCESS_FINE_LOCATION)
                    != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                Toast.makeText(this, "Location permission required", Toast.LENGTH_SHORT).show();
                return;
            }
            com.google.android.gms.location.LocationServices
                    .getFusedLocationProviderClient(this)
                    .getLastLocation()
                    .addOnSuccessListener(location -> {
                        if (location != null) {
                            etLat.setText(String.valueOf(location.getLatitude()));
                            etLng.setText(String.valueOf(location.getLongitude()));
                            Toast.makeText(this, "Location captured", Toast.LENGTH_SHORT).show();
                        } else {
                            Toast.makeText(this, "Unable to get location", Toast.LENGTH_SHORT).show();
                        }
                    });
        });

        String title = existing != null ? "Edit Address" : "Add New Address";
        new MaterialAlertDialogBuilder(this)
                .setTitle(title)
                .setView(dialogView)
                .setPositiveButton("Save", (dialog, which) -> {
                    String label = etLabel.getText().toString().trim();
                    String addressText = etAddressText.getText().toString().trim();
                    String latStr = etLat.getText().toString().trim();
                    String lngStr = etLng.getText().toString().trim();

                    if (label.isEmpty() || addressText.isEmpty()) {
                        Toast.makeText(this, "Label and address are required",
                                Toast.LENGTH_SHORT).show();
                        return;
                    }

                    double lat = 0, lng = 0;
                    try { lat = Double.parseDouble(latStr); } catch (NumberFormatException ignored) {}
                    try { lng = Double.parseDouble(lngStr); } catch (NumberFormatException ignored) {}

                    Map<String, Object> data = new HashMap<>();
                    data.put("label", label);
                    data.put("address_text", addressText);
                    data.put("lat", lat);
                    data.put("lng", lng);

                    if (existing != null) {
                        updateAddress(existing.getId(), data);
                    } else {
                        createAddress(data);
                    }
                })
                .setNegativeButton("Cancel", null)
                .show();
    }

    // ── API calls ─────────────────────────────────────────────────────

    private void createAddress(Map<String, Object> data) {
        binding.progressBar.setVisibility(View.VISIBLE);
        ApiClient.getInstance().getApiService().createAddress(data).enqueue(new Callback<Address>() {
            @Override
            public void onResponse(Call<Address> call, Response<Address> response) {
                binding.progressBar.setVisibility(View.GONE);
                if (response.isSuccessful() && response.body() != null) {
                    Toast.makeText(AddressBookActivity.this, "Address added", Toast.LENGTH_SHORT).show();
                    fetchAddressesFromApi();
                } else {
                    Toast.makeText(AddressBookActivity.this, "Failed to add address", Toast.LENGTH_SHORT).show();
                }
            }
            @Override
            public void onFailure(Call<Address> call, Throwable t) {
                binding.progressBar.setVisibility(View.GONE);
                Toast.makeText(AddressBookActivity.this, getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void updateAddress(String id, Map<String, Object> data) {
        binding.progressBar.setVisibility(View.VISIBLE);
        ApiClient.getInstance().getApiService().updateAddress(id, data).enqueue(new Callback<Address>() {
            @Override
            public void onResponse(Call<Address> call, Response<Address> response) {
                binding.progressBar.setVisibility(View.GONE);
                if (response.isSuccessful()) {
                    Toast.makeText(AddressBookActivity.this, "Address updated", Toast.LENGTH_SHORT).show();
                    fetchAddressesFromApi();
                } else {
                    Toast.makeText(AddressBookActivity.this, "Failed to update address", Toast.LENGTH_SHORT).show();
                }
            }
            @Override
            public void onFailure(Call<Address> call, Throwable t) {
                binding.progressBar.setVisibility(View.GONE);
                Toast.makeText(AddressBookActivity.this, getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void deleteAddress(Address address) {
        binding.progressBar.setVisibility(View.VISIBLE);
        ApiClient.getInstance().getApiService().deleteAddress(address.getId()).enqueue(new Callback<Void>() {
            @Override
            public void onResponse(Call<Void> call, Response<Void> response) {
                binding.progressBar.setVisibility(View.GONE);
                if (response.isSuccessful()) {
                    Toast.makeText(AddressBookActivity.this, "Address deleted", Toast.LENGTH_SHORT).show();
                    Executors.newSingleThreadExecutor().execute(() ->
                            AppDatabase.getInstance(AddressBookActivity.this)
                                    .addressDao().deleteById(address.getId()));
                    fetchAddressesFromApi();
                } else {
                    Toast.makeText(AddressBookActivity.this, "Failed to delete", Toast.LENGTH_SHORT).show();
                }
            }
            @Override
            public void onFailure(Call<Void> call, Throwable t) {
                binding.progressBar.setVisibility(View.GONE);
                Toast.makeText(AddressBookActivity.this, getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }
}
