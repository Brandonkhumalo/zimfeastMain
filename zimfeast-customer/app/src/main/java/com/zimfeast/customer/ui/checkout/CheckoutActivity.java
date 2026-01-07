package com.zimfeast.customer.ui.checkout;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.RadioGroup;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.model.Order;
import com.zimfeast.customer.data.model.PaymentRequest;
import com.zimfeast.customer.data.model.PaymentResponse;
import com.zimfeast.customer.data.model.VoucherBalance;
import com.zimfeast.customer.databinding.ActivityCheckoutBinding;
import com.zimfeast.customer.ui.tracking.OrderTrackingActivity;
import com.zimfeast.customer.util.DeliveryUtils;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CheckoutActivity extends AppCompatActivity {

    private ActivityCheckoutBinding binding;
    private String orderId;
    private Order currentOrder;
    private String selectedPaymentMethod = "web";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityCheckoutBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        orderId = getIntent().getStringExtra("orderId");
        if (orderId == null) {
            Toast.makeText(this, "Order not found", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        setupViews();
        loadOrderDetails();
    }

    private void setupViews() {
        binding.btnBack.setOnClickListener(v -> finish());

        binding.rgPaymentMethod.setOnCheckedChangeListener((group, checkedId) -> {
            if (checkedId == R.id.rb_paynow_web) {
                selectedPaymentMethod = "web";
                binding.layoutMobilePayment.setVisibility(View.GONE);
                binding.layoutVoucher.setVisibility(View.GONE);
            } else if (checkedId == R.id.rb_paynow_mobile) {
                selectedPaymentMethod = "mobile";
                binding.layoutMobilePayment.setVisibility(View.VISIBLE);
                binding.layoutVoucher.setVisibility(View.GONE);
            } else if (checkedId == R.id.rb_voucher) {
                selectedPaymentMethod = "voucher";
                binding.layoutMobilePayment.setVisibility(View.GONE);
                binding.layoutVoucher.setVisibility(View.VISIBLE);
                loadVoucherBalance();
            }
        });

        String[] providers = {getString(R.string.ecocash), getString(R.string.onemoney), getString(R.string.innbucks)};
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, providers);
        binding.spinnerProvider.setAdapter(adapter);

        binding.btnPay.setOnClickListener(v -> processPayment());
    }

    private void loadOrderDetails() {
        setLoading(true);

        ApiClient.getInstance().getApiService().getOrder(orderId).enqueue(new Callback<Order>() {
            @Override
            public void onResponse(Call<Order> call, Response<Order> response) {
                setLoading(false);

                if (response.isSuccessful() && response.body() != null) {
                    currentOrder = response.body();
                    displayOrderDetails();
                } else {
                    Toast.makeText(CheckoutActivity.this, "Failed to load order", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<Order> call, Throwable t) {
                setLoading(false);
                Toast.makeText(CheckoutActivity.this, getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void displayOrderDetails() {
        if (currentOrder == null) return;

        String currency = currentOrder.getCurrency() != null ? currentOrder.getCurrency() : "USD";
        binding.tvSubtotal.setText(DeliveryUtils.formatCurrency(currentOrder.getSubtotal(), currency));
        binding.tvDeliveryFee.setText(DeliveryUtils.formatCurrency(currentOrder.getDeliveryFee(), currency));
        binding.tvTotal.setText(DeliveryUtils.formatCurrency(currentOrder.getTotal(), currency));

        if (currentOrder.getItems() != null) {
            StringBuilder itemsText = new StringBuilder();
            for (Order.OrderItem item : currentOrder.getItems()) {
                itemsText.append(item.getQuantity()).append("x ").append(item.getName()).append("\n");
            }
            binding.tvOrderItems.setText(itemsText.toString().trim());
        }
    }

    private void loadVoucherBalance() {
        ApiClient.getInstance().getApiService().getVoucherBalance().enqueue(new Callback<VoucherBalance>() {
            @Override
            public void onResponse(Call<VoucherBalance> call, Response<VoucherBalance> response) {
                if (response.isSuccessful() && response.body() != null) {
                    double balance = response.body().getBalance();
                    binding.tvVoucherBalance.setText("Balance: " + DeliveryUtils.formatCurrency(balance, "USD"));
                }
            }

            @Override
            public void onFailure(Call<VoucherBalance> call, Throwable t) {
                binding.tvVoucherBalance.setText("Unable to load balance");
            }
        });
    }

    private void processPayment() {
        if (currentOrder == null) {
            Toast.makeText(this, "Order not loaded", Toast.LENGTH_SHORT).show();
            return;
        }

        PaymentRequest request;

        if ("mobile".equals(selectedPaymentMethod)) {
            String phone = binding.etPhone.getText().toString().trim();
            if (phone.isEmpty()) {
                Toast.makeText(this, "Please enter your phone number", Toast.LENGTH_SHORT).show();
                return;
            }

            String normalizedPhone = DeliveryUtils.normalizePhoneNumber(phone);
            String provider = getProviderValue(binding.spinnerProvider.getSelectedItemPosition());
            request = new PaymentRequest(orderId, "paynow", normalizedPhone, provider);
        } else if ("voucher".equals(selectedPaymentMethod)) {
            request = new PaymentRequest(orderId, "voucher");
        } else {
            request = new PaymentRequest(orderId, "paynow");
        }

        setLoading(true);

        ApiClient.getInstance().getApiService().createPayment(request).enqueue(new Callback<PaymentResponse>() {
            @Override
            public void onResponse(Call<PaymentResponse> call, Response<PaymentResponse> response) {
                setLoading(false);

                if (response.isSuccessful() && response.body() != null) {
                    PaymentResponse paymentResponse = response.body();

                    if ("web".equals(selectedPaymentMethod) && paymentResponse.getRedirectUrl() != null) {
                        Intent intent = new Intent(CheckoutActivity.this, PayNowWebViewActivity.class);
                        intent.putExtra("url", paymentResponse.getRedirectUrl());
                        intent.putExtra("orderId", orderId);
                        startActivity(intent);
                    } else {
                        Toast.makeText(CheckoutActivity.this, "Payment initiated!", Toast.LENGTH_SHORT).show();
                        Intent intent = new Intent(CheckoutActivity.this, OrderTrackingActivity.class);
                        intent.putExtra("orderId", orderId);
                        startActivity(intent);
                    }
                    finish();
                } else {
                    Toast.makeText(CheckoutActivity.this, getString(R.string.error_payment), Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<PaymentResponse> call, Throwable t) {
                setLoading(false);
                Toast.makeText(CheckoutActivity.this, getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private String getProviderValue(int position) {
        switch (position) {
            case 1: return "onemoney";
            case 2: return "innbucks";
            default: return "ecocash";
        }
    }

    private void setLoading(boolean loading) {
        binding.progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        binding.btnPay.setEnabled(!loading);
        binding.btnPay.setText(loading ? getString(R.string.processing) : getString(R.string.pay_now));
    }
}
