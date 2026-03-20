package com.zimfeast.customer.ui.checkout;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;

import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.model.Order;
import com.zimfeast.customer.data.model.PaymentRequest;
import com.zimfeast.customer.data.model.PaymentResponse;
import com.zimfeast.customer.data.model.PromoValidation;
import com.zimfeast.customer.data.model.ReferralCreditsResponse;
import com.zimfeast.customer.data.model.VoucherBalance;
import com.zimfeast.customer.databinding.ActivityCheckoutBinding;
import com.zimfeast.customer.ui.tracking.OrderTrackingActivity;
import com.zimfeast.customer.util.DeliveryUtils;

import java.util.HashMap;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CheckoutActivity extends AppCompatActivity {

    private ActivityCheckoutBinding binding;
    private String orderId;
    private Order currentOrder;
    private String selectedPaymentMethod = "web";
    private boolean isDirectPayment = false;
    private boolean useVoucher = false;
    private double voucherBalance = 0;

    // Promo code state
    private PromoValidation appliedPromo = null;
    private double promoDiscount = 0;

    // Referral credit state
    private boolean useReferralCredit = false;
    private int availableReferralCredits = 0;
    private double referralDiscount = 0;

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
        loadReferralCredits();
    }

    private void setupViews() {
        binding.btnBack.setOnClickListener(v -> finish());

        // Payment method radio group listener
        binding.rgPaymentMethod.setOnCheckedChangeListener((group, checkedId) -> {
            if (checkedId == R.id.rb_paynow_web) {
                selectedPaymentMethod = "web";
                binding.layoutMobilePayment.setVisibility(View.GONE);
                binding.layoutVoucher.setVisibility(View.GONE);
                binding.layoutUseVoucher.setVisibility(isDirectPayment ? View.GONE : View.VISIBLE);
            } else if (checkedId == R.id.rb_paynow_mobile) {
                selectedPaymentMethod = "mobile";
                binding.layoutMobilePayment.setVisibility(View.VISIBLE);
                binding.layoutVoucher.setVisibility(View.GONE);
                binding.layoutUseVoucher.setVisibility(isDirectPayment ? View.GONE : View.VISIBLE);
            } else if (checkedId == R.id.rb_voucher) {
                selectedPaymentMethod = "voucher";
                binding.layoutMobilePayment.setVisibility(View.GONE);
                binding.layoutVoucher.setVisibility(View.VISIBLE);
                binding.layoutUseVoucher.setVisibility(View.GONE);
                useVoucher = false;
                binding.cbUseVoucher.setChecked(false);
                loadVoucherBalance();
            }
            updatePayButton();
        });

        // Mobile provider spinner
        String[] providers = {getString(R.string.ecocash), getString(R.string.onemoney), getString(R.string.innbucks)};
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_dropdown_item, providers);
        binding.spinnerProvider.setAdapter(adapter);

        // Voucher checkbox
        binding.cbUseVoucher.setOnCheckedChangeListener((buttonView, isChecked) -> {
            useVoucher = isChecked;
            if (isChecked) {
                loadVoucherBalance();
                binding.layoutVoucherBreakdown.setVisibility(View.VISIBLE);
            } else {
                binding.layoutVoucherBreakdown.setVisibility(View.GONE);
            }
            updatePayButton();
        });

        // Promo code apply button
        binding.btnApplyPromo.setOnClickListener(v -> validatePromoCode());

        // Promo code remove button
        binding.btnRemovePromo.setOnClickListener(v -> removePromoCode());

        // Referral credit checkbox
        binding.cbUseReferral.setOnCheckedChangeListener((buttonView, isChecked) -> {
            useReferralCredit = isChecked;
            updateDiscountBreakdown();
            updatePayButton();
        });

        binding.btnPay.setOnClickListener(v -> processPayment());
    }

    private void loadOrderDetails() {
        setLoading(true);

        ApiClient.getInstance().getApiService().getOrder(orderId).enqueue(new Callback<Order>() {
            @Override
            public void onResponse(Call<Order> call, Response<Order> response) {
                if (isFinishing() || isDestroyed()) return;
                setLoading(false);

                if (response.isSuccessful() && response.body() != null) {
                    currentOrder = response.body();
                    displayOrderDetails();
                    checkDirectPayment();
                } else {
                    Toast.makeText(CheckoutActivity.this, "Failed to load order", Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<Order> call, Throwable t) {
                if (isFinishing() || isDestroyed()) return;
                setLoading(false);
                Toast.makeText(CheckoutActivity.this, getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void checkDirectPayment() {
        if (currentOrder == null || currentOrder.getRestaurantId() == null) return;

        ApiClient.getInstance().getApiService().getRestaurantPaymentInfo(currentOrder.getRestaurantId())
                .enqueue(new Callback<Map<String, Object>>() {
                    @Override
                    public void onResponse(Call<Map<String, Object>> call, Response<Map<String, Object>> response) {
                        if (isFinishing() || isDestroyed()) return;
                        if (response.isSuccessful() && response.body() != null) {
                            Object directObj = response.body().get("accepts_direct_payment");
                            isDirectPayment = directObj instanceof Boolean && (Boolean) directObj;

                            if (isDirectPayment) {
                                binding.rbVoucher.setVisibility(View.GONE);
                                binding.layoutUseVoucher.setVisibility(View.GONE);
                                binding.tvDirectPaymentNotice.setVisibility(View.VISIBLE);
                                if ("voucher".equals(selectedPaymentMethod)) {
                                    binding.rbPaynowWeb.setChecked(true);
                                }
                                useVoucher = false;
                                binding.cbUseVoucher.setChecked(false);
                            } else {
                                binding.layoutUseVoucher.setVisibility(View.VISIBLE);
                            }
                        }
                    }

                    @Override
                    public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                        // Default: non-direct payment
                    }
                });
    }

    private void displayOrderDetails() {
        if (currentOrder == null) return;

        String currency = currentOrder.getCurrency() != null ? currentOrder.getCurrency() : "USD";
        binding.tvSubtotal.setText(DeliveryUtils.formatCurrency(currentOrder.getSubtotal(), currency));
        binding.tvDeliveryFee.setText(DeliveryUtils.formatCurrency(currentOrder.getDeliveryFee(), currency));
        binding.tvTotal.setText(DeliveryUtils.formatCurrency(currentOrder.getTotal(), currency));

        if (currentOrder.getTip() > 0) {
            binding.layoutTipRow.setVisibility(View.VISIBLE);
            binding.tvTip.setText(DeliveryUtils.formatCurrency(currentOrder.getTip(), currency));
        } else {
            binding.layoutTipRow.setVisibility(View.GONE);
        }

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
                    voucherBalance = response.body().getBalance();
                    binding.tvVoucherBalance.setText("Balance: " + DeliveryUtils.formatCurrency(voucherBalance, "USD"));
                    updateVoucherBreakdown();
                    updatePayButton();
                }
            }

            @Override
            public void onFailure(Call<VoucherBalance> call, Throwable t) {
                binding.tvVoucherBalance.setText("Unable to load balance");
            }
        });
    }

    // ─── Promo Code Logic ──────────────────────────────────────────────

    private void validatePromoCode() {
        String code = binding.etPromoCode.getText().toString().trim().toUpperCase();
        if (code.isEmpty()) {
            Toast.makeText(this, "Please enter a promo code", Toast.LENGTH_SHORT).show();
            return;
        }

        if (currentOrder == null) return;

        binding.btnApplyPromo.setEnabled(false);
        binding.tvPromoError.setVisibility(View.GONE);

        Map<String, Object> body = new HashMap<>();
        body.put("code", code);
        body.put("order_amount", currentOrder.getTotal());

        ApiClient.getInstance().getApiService().validatePromo(body).enqueue(new Callback<PromoValidation>() {
            @Override
            public void onResponse(Call<PromoValidation> call, Response<PromoValidation> response) {
                if (isFinishing() || isDestroyed()) return;
                binding.btnApplyPromo.setEnabled(true);

                if (response.isSuccessful() && response.body() != null) {
                    PromoValidation validation = response.body();
                    appliedPromo = validation;

                    // Parse discount amount
                    if (validation.getDiscountAmount() != null) {
                        try {
                            promoDiscount = Double.parseDouble(validation.getDiscountAmount());
                        } catch (NumberFormatException e) {
                            promoDiscount = 0;
                        }
                    }

                    // Show applied state
                    binding.layoutPromoInput.setVisibility(View.GONE);
                    binding.layoutPromoApplied.setVisibility(View.VISIBLE);
                    binding.tvPromoCodeApplied.setText(validation.getCode());
                    binding.tvPromoMessage.setText(validation.getMessage());

                    updateDiscountBreakdown();
                    updatePayButton();
                    Toast.makeText(CheckoutActivity.this, "Promo code applied!", Toast.LENGTH_SHORT).show();
                } else {
                    // Try to parse error response
                    try {
                        String errorBody = response.errorBody() != null ? response.errorBody().string() : "";
                        // Simple extraction of "detail" field
                        if (errorBody.contains("\"detail\"")) {
                            int start = errorBody.indexOf("\"detail\"") + 10;
                            int end = errorBody.indexOf("\"", start);
                            String detail = errorBody.substring(start, end);
                            binding.tvPromoError.setText(detail);
                        } else {
                            binding.tvPromoError.setText("Invalid promo code.");
                        }
                    } catch (Exception e) {
                        binding.tvPromoError.setText("Invalid promo code.");
                    }
                    binding.tvPromoError.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onFailure(Call<PromoValidation> call, Throwable t) {
                if (isFinishing() || isDestroyed()) return;
                binding.btnApplyPromo.setEnabled(true);
                binding.tvPromoError.setText("Failed to validate promo code.");
                binding.tvPromoError.setVisibility(View.VISIBLE);
            }
        });
    }

    private void removePromoCode() {
        appliedPromo = null;
        promoDiscount = 0;
        binding.etPromoCode.setText("");
        binding.layoutPromoInput.setVisibility(View.VISIBLE);
        binding.layoutPromoApplied.setVisibility(View.GONE);
        binding.tvPromoError.setVisibility(View.GONE);
        updateDiscountBreakdown();
        updatePayButton();
    }

    // ─── Referral Credits Logic ────────────────────────────────────────

    private void loadReferralCredits() {
        ApiClient.getInstance().getApiService().getReferralCredits().enqueue(new Callback<ReferralCreditsResponse>() {
            @Override
            public void onResponse(Call<ReferralCreditsResponse> call, Response<ReferralCreditsResponse> response) {
                if (isFinishing() || isDestroyed()) return;
                if (response.isSuccessful() && response.body() != null) {
                    availableReferralCredits = response.body().getAvailableCredits();
                    if (availableReferralCredits > 0) {
                        binding.cardReferralCredit.setVisibility(View.VISIBLE);
                        String creditText = availableReferralCredits + " credit"
                                + (availableReferralCredits != 1 ? "s" : "") + " available";
                        binding.tvReferralCreditsCount.setText(creditText);
                    }
                }
            }

            @Override
            public void onFailure(Call<ReferralCreditsResponse> call, Throwable t) {
                // Silently fail - referral is optional
            }
        });
    }

    // ─── Discount Breakdown ────────────────────────────────────────────

    private void updateDiscountBreakdown() {
        if (currentOrder == null) return;

        double total = currentOrder.getTotal();
        boolean hasDiscount = false;

        // Promo discount
        if (promoDiscount > 0) {
            binding.layoutPromoDiscountRow.setVisibility(View.VISIBLE);
            String label = appliedPromo != null
                    ? "Promo (" + appliedPromo.getCode() + ")"
                    : "Promo discount";
            binding.tvPromoDiscountLabel.setText(label);
            binding.tvPromoDiscountAmount.setText("-" + DeliveryUtils.formatCurrency(promoDiscount, "USD"));
            hasDiscount = true;
        } else {
            binding.layoutPromoDiscountRow.setVisibility(View.GONE);
        }

        // Referral discount (15% of amount after promo)
        if (useReferralCredit && availableReferralCredits > 0) {
            double afterPromo = total - promoDiscount;
            referralDiscount = afterPromo * 0.15;
            binding.layoutReferralDiscountRow.setVisibility(View.VISIBLE);
            binding.tvReferralDiscountAmount.setText("-" + DeliveryUtils.formatCurrency(referralDiscount, "USD"));
            hasDiscount = true;
        } else {
            referralDiscount = 0;
            binding.layoutReferralDiscountRow.setVisibility(View.GONE);
        }

        if (hasDiscount) {
            double discountedTotal = total - promoDiscount - referralDiscount;
            if (discountedTotal < 0) discountedTotal = 0;
            binding.tvDiscountedTotal.setText(DeliveryUtils.formatCurrency(discountedTotal, "USD"));
            binding.layoutDiscountBreakdown.setVisibility(View.VISIBLE);
        } else {
            binding.layoutDiscountBreakdown.setVisibility(View.GONE);
        }
    }

    // ─── Existing helpers (updated for discounts) ──────────────────────

    private void updateVoucherBreakdown() {
        if (currentOrder == null || !useVoucher) return;

        double total = getAmountAfterDiscounts();
        double deduction = Math.min(voucherBalance, total);
        double paynowAmt = total - deduction;

        binding.tvVoucherDeduction.setText("-" + DeliveryUtils.formatCurrency(deduction, "USD"));
        binding.tvPaynowAmount.setText(DeliveryUtils.formatCurrency(paynowAmt, "USD"));
        binding.layoutVoucherBreakdown.setVisibility(View.VISIBLE);
    }

    private double getAmountAfterDiscounts() {
        if (currentOrder == null) return 0;
        double total = currentOrder.getTotal() - promoDiscount - referralDiscount;
        return Math.max(total, 0);
    }

    private void updatePayButton() {
        if (currentOrder == null) return;

        double payAmount = getAmountAfterDiscounts();

        if (useVoucher && voucherBalance > 0 && !"voucher".equals(selectedPaymentMethod)) {
            double paynowAmt = payAmount - Math.min(voucherBalance, payAmount);
            if (paynowAmt > 0) {
                binding.btnPay.setText("Pay " + DeliveryUtils.formatCurrency(paynowAmt, "USD") + " via PayNow");
            } else {
                binding.btnPay.setText("Pay with Voucher");
            }
        } else if (promoDiscount > 0 || referralDiscount > 0) {
            binding.btnPay.setText("Pay " + DeliveryUtils.formatCurrency(payAmount, "USD"));
        } else {
            binding.btnPay.setText(getString(R.string.pay_now));
        }
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
            request = new PaymentRequest(orderId, "paynow", normalizedPhone, provider, useVoucher);
        } else if ("voucher".equals(selectedPaymentMethod)) {
            request = new PaymentRequest(orderId, "voucher");
        } else {
            // Web payment - include useVoucher flag
            request = new PaymentRequest(orderId, "paynow", useVoucher);
        }

        // Attach promo code if applied
        if (appliedPromo != null) {
            request.setPromoCode(appliedPromo.getCode());
        }

        // Attach referral credit flag
        if (useReferralCredit && availableReferralCredits > 0) {
            request.setUseReferralCredit(true);
        }

        setLoading(true);

        ApiClient.getInstance().getApiService().createPayment(request).enqueue(new Callback<PaymentResponse>() {
            @Override
            public void onResponse(Call<PaymentResponse> call, Response<PaymentResponse> response) {
                if (isFinishing() || isDestroyed()) return;
                setLoading(false);

                if (response.isSuccessful() && response.body() != null) {
                    PaymentResponse paymentResponse = response.body();
                    handlePaymentResponse(paymentResponse);
                } else {
                    Toast.makeText(CheckoutActivity.this, getString(R.string.error_payment), Toast.LENGTH_SHORT).show();
                }
            }

            @Override
            public void onFailure(Call<PaymentResponse> call, Throwable t) {
                if (isFinishing() || isDestroyed()) return;
                setLoading(false);
                Toast.makeText(CheckoutActivity.this, getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void handlePaymentResponse(PaymentResponse paymentResponse) {
        String status = paymentResponse.getStatus();

        // Paid fully with voucher
        if ("paid_with_voucher".equals(status)) {
            String msg = paymentResponse.getVoucherUsed() != null
                    ? "Voucher covered the order ($" + paymentResponse.getVoucherUsed() + " used)"
                    : "Paid with voucher";
            Toast.makeText(this, msg, Toast.LENGTH_SHORT).show();
            navigateToTracking();
            return;
        }

        // Partial voucher + PayNow
        if ("partial_voucher".equals(status) && paymentResponse.getRedirectUrl() != null) {
            String msg = "$" + paymentResponse.getVoucherUsed() + " from voucher. Pay $" +
                    paymentResponse.getPaynowAmount() + " via PayNow.";
            Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
            openPayNow(paymentResponse.getRedirectUrl());
            return;
        }

        // Regular PayNow (web or direct)
        if (paymentResponse.getRedirectUrl() != null) {
            if ("web".equals(selectedPaymentMethod)) {
                openPayNow(paymentResponse.getRedirectUrl());
            } else {
                Toast.makeText(this, "Payment initiated!", Toast.LENGTH_SHORT).show();
                navigateToTracking();
            }
            return;
        }

        // Fallback
        Toast.makeText(this, "Payment initiated!", Toast.LENGTH_SHORT).show();
        navigateToTracking();
    }

    private void openPayNow(String url) {
        Intent intent = new Intent(this, PayNowWebViewActivity.class);
        intent.putExtra("url", url);
        intent.putExtra("orderId", orderId);
        startActivity(intent);
        finish();
    }

    private void navigateToTracking() {
        Intent intent = new Intent(this, OrderTrackingActivity.class);
        intent.putExtra("orderId", orderId);
        startActivity(intent);
        finish();
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
