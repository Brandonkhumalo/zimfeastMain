package com.zimfeast.customer.ui.rating;

import android.app.Dialog;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.widget.Button;
import android.widget.RatingBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.DialogFragment;

import com.google.android.material.textfield.TextInputEditText;
import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;

import java.util.HashMap;
import java.util.Map;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * DialogFragment that shows two star-rating bars (restaurant + driver) and an optional
 * comment field. It is displayed after an order transitions to the "delivered" status.
 *
 * Usage:
 *   RatingDialog dialog = RatingDialog.newInstance(
 *       orderId, restaurantId, restaurantName, driverName, driverId
 *   );
 *   dialog.show(getSupportFragmentManager(), "rating_dialog");
 */
public class RatingDialog extends DialogFragment {

    private static final String ARG_ORDER_ID = "order_id";
    private static final String ARG_RESTAURANT_ID = "restaurant_id";
    private static final String ARG_RESTAURANT_NAME = "restaurant_name";
    private static final String ARG_DRIVER_NAME = "driver_name";
    private static final String ARG_DRIVER_ID = "driver_id";

    /**
     * Factory method that creates a new RatingDialog with the required arguments
     * bundled in, so the fragment can be recreated on configuration changes.
     */
    public static RatingDialog newInstance(String orderId, String restaurantId,
                                           String restaurantName, String driverName,
                                           String driverId) {
        RatingDialog dialog = new RatingDialog();
        Bundle args = new Bundle();
        args.putString(ARG_ORDER_ID, orderId);
        args.putString(ARG_RESTAURANT_ID, restaurantId);
        args.putString(ARG_RESTAURANT_NAME, restaurantName);
        args.putString(ARG_DRIVER_NAME, driverName);
        args.putString(ARG_DRIVER_ID, driverId);
        dialog.setArguments(args);
        return dialog;
    }

    @NonNull
    @Override
    public Dialog onCreateDialog(@Nullable Bundle savedInstanceState) {
        Dialog dialog = super.onCreateDialog(savedInstanceState);
        // Remove the default title bar so our custom layout fills the dialog.
        if (dialog.getWindow() != null) {
            dialog.getWindow().requestFeature(Window.FEATURE_NO_TITLE);
        }
        return dialog;
    }

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater,
                             @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.dialog_rating, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        // Extract arguments
        Bundle args = getArguments();
        String orderId = args != null ? args.getString(ARG_ORDER_ID, "") : "";
        String restaurantId = args != null ? args.getString(ARG_RESTAURANT_ID, "") : "";
        String restaurantName = args != null ? args.getString(ARG_RESTAURANT_NAME, "Restaurant") : "Restaurant";
        String driverName = args != null ? args.getString(ARG_DRIVER_NAME, "") : "";
        String driverId = args != null ? args.getString(ARG_DRIVER_ID, "") : "";

        // Bind views
        TextView tvRestaurantLabel = view.findViewById(R.id.tv_restaurant_label);
        RatingBar ratingRestaurant = view.findViewById(R.id.rating_restaurant);
        TextView tvDriverLabel = view.findViewById(R.id.tv_driver_label);
        RatingBar ratingDriver = view.findViewById(R.id.rating_driver);
        TextInputEditText etComment = view.findViewById(R.id.et_comment);
        Button btnSkip = view.findViewById(R.id.btn_skip);
        Button btnSubmit = view.findViewById(R.id.btn_submit_rating);

        // Set labels
        tvRestaurantLabel.setText("Rate " + restaurantName);
        if (driverName != null && !driverName.isEmpty()) {
            tvDriverLabel.setText("Rate your driver: " + driverName);
            tvDriverLabel.setVisibility(View.VISIBLE);
            ratingDriver.setVisibility(View.VISIBLE);
        } else {
            tvDriverLabel.setVisibility(View.GONE);
            ratingDriver.setVisibility(View.GONE);
        }

        // Skip button closes dialog without submitting
        btnSkip.setOnClickListener(v -> dismiss());

        // Submit button sends ratings to both endpoints
        btnSubmit.setOnClickListener(v -> {
            int restaurantRating = (int) ratingRestaurant.getRating();
            int driverRating = (int) ratingDriver.getRating();
            String comment = etComment.getText() != null ? etComment.getText().toString().trim() : "";

            if (restaurantRating == 0 && driverRating == 0) {
                Toast.makeText(requireContext(), "Please select at least one rating", Toast.LENGTH_SHORT).show();
                return;
            }

            btnSubmit.setEnabled(false);
            btnSubmit.setText("Submitting...");

            // Track how many API calls we need to make so we dismiss after both finish
            final int[] remaining = { 0 };
            if (restaurantRating > 0) remaining[0]++;
            if (driverRating > 0 && !driverId.isEmpty()) remaining[0]++;

            // If nothing to submit (shouldn't happen), just dismiss
            if (remaining[0] == 0) {
                dismiss();
                return;
            }

            // Callback to dismiss dialog once all API calls have finished
            Runnable onDone = () -> {
                remaining[0]--;
                if (remaining[0] <= 0 && isAdded()) {
                    Toast.makeText(requireContext(), "Thanks for your feedback!", Toast.LENGTH_SHORT).show();
                    dismiss();
                }
            };

            // 1. Submit restaurant review
            if (restaurantRating > 0) {
                Map<String, Object> body = new HashMap<>();
                body.put("order_id", orderId);
                body.put("rating", restaurantRating);
                body.put("comment", comment);

                ApiClient.getInstance().getApiService()
                        .submitRestaurantReview(restaurantId, body)
                        .enqueue(new Callback<Map<String, Object>>() {
                            @Override
                            public void onResponse(Call<Map<String, Object>> call,
                                                   Response<Map<String, Object>> response) {
                                if (isAdded()) {
                                    requireActivity().runOnUiThread(onDone);
                                }
                            }

                            @Override
                            public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                                if (isAdded()) {
                                    requireActivity().runOnUiThread(onDone);
                                }
                            }
                        });
            }

            // 2. Submit driver rating
            if (driverRating > 0 && !driverId.isEmpty()) {
                Map<String, Object> body = new HashMap<>();
                body.put("driver_id", driverId);
                body.put("rating", driverRating);
                body.put("comment", "");

                ApiClient.getInstance().getApiService()
                        .submitDriverRating(body)
                        .enqueue(new Callback<Map<String, Object>>() {
                            @Override
                            public void onResponse(Call<Map<String, Object>> call,
                                                   Response<Map<String, Object>> response) {
                                if (isAdded()) {
                                    requireActivity().runOnUiThread(onDone);
                                }
                            }

                            @Override
                            public void onFailure(Call<Map<String, Object>> call, Throwable t) {
                                if (isAdded()) {
                                    requireActivity().runOnUiThread(onDone);
                                }
                            }
                        });
            }
        });
    }

    @Override
    public void onStart() {
        super.onStart();
        // Make the dialog wider
        if (getDialog() != null && getDialog().getWindow() != null) {
            getDialog().getWindow().setLayout(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
            );
            getDialog().getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        }
    }
}
