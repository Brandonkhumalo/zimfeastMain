package com.zimfeast.driver.ui;

import android.os.Bundle;
import android.view.View;
import android.widget.ImageButton;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.zimfeast.driver.R;
import com.zimfeast.driver.data.api.ApiClient;
import com.zimfeast.driver.data.api.ApiService;
import com.zimfeast.driver.data.model.Order;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Displays the driver's order history in a RecyclerView.
 * Fetches data from GET /api/drivers/orders/ and shows each order
 * with its date, status, restaurant, and earnings.
 */
public class OrderHistoryActivity extends AppCompatActivity {

    private RecyclerView recyclerView;
    private OrderHistoryAdapter adapter;
    private ProgressBar progressBar;
    private LinearLayout emptyState;
    private TextView tvEmptyMessage;
    private SwipeRefreshLayout swipeRefresh;

    private ApiService apiService;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_history);

        apiService = ApiClient.getClient().create(ApiService.class);

        initViews();
        loadOrders();
    }

    private void initViews() {
        // Toolbar back button
        ImageButton btnBack = findViewById(R.id.btn_back);
        btnBack.setOnClickListener(v -> finish());

        recyclerView = findViewById(R.id.recycler_orders);
        progressBar = findViewById(R.id.progress_bar);
        emptyState = findViewById(R.id.empty_state);
        tvEmptyMessage = findViewById(R.id.tv_empty_message);
        swipeRefresh = findViewById(R.id.swipe_refresh);

        // Set up RecyclerView with a vertical linear layout manager
        recyclerView.setLayoutManager(new LinearLayoutManager(this));
        adapter = new OrderHistoryAdapter(new ArrayList<>());
        recyclerView.setAdapter(adapter);

        // Pull-to-refresh support
        swipeRefresh.setColorSchemeResources(R.color.primary);
        swipeRefresh.setOnRefreshListener(this::loadOrders);
    }

    /**
     * Calls the getDriverOrders API endpoint to fetch order history.
     * Shows a loading indicator while the request is in progress.
     * On success, populates the RecyclerView; on empty, shows empty state.
     */
    private void loadOrders() {
        progressBar.setVisibility(View.VISIBLE);
        emptyState.setVisibility(View.GONE);
        recyclerView.setVisibility(View.GONE);

        apiService.getDriverOrders().enqueue(new Callback<List<Order>>() {
            @Override
            public void onResponse(Call<List<Order>> call, Response<List<Order>> response) {
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;

                    progressBar.setVisibility(View.GONE);
                    swipeRefresh.setRefreshing(false);

                    if (response.isSuccessful() && response.body() != null) {
                        List<Order> orders = response.body();
                        if (orders.isEmpty()) {
                            showEmptyState("No order history yet");
                        } else {
                            // Update adapter with the fetched orders
                            adapter.updateOrders(orders);
                            recyclerView.setVisibility(View.VISIBLE);
                        }
                    } else {
                        showEmptyState("Failed to load orders");
                        Toast.makeText(OrderHistoryActivity.this,
                                "Failed to load order history", Toast.LENGTH_SHORT).show();
                    }
                });
            }

            @Override
            public void onFailure(Call<List<Order>> call, Throwable t) {
                runOnUiThread(() -> {
                    if (isFinishing() || isDestroyed()) return;

                    progressBar.setVisibility(View.GONE);
                    swipeRefresh.setRefreshing(false);
                    showEmptyState("Network error. Pull to retry.");
                    Toast.makeText(OrderHistoryActivity.this,
                            "Network error: " + t.getMessage(), Toast.LENGTH_SHORT).show();
                });
            }
        });
    }

    /**
     * Shows the empty state view with a custom message.
     */
    private void showEmptyState(String message) {
        recyclerView.setVisibility(View.GONE);
        emptyState.setVisibility(View.VISIBLE);
        tvEmptyMessage.setText(message);
    }
}
