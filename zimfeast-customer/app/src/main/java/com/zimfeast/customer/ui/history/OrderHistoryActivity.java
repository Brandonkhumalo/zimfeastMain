package com.zimfeast.customer.ui.history;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;

import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.data.model.Order;
import com.zimfeast.customer.databinding.ActivityOrderHistoryBinding;
import com.zimfeast.customer.ui.tracking.OrderTrackingActivity;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class OrderHistoryActivity extends AppCompatActivity implements OrderHistoryAdapter.OnOrderClickListener {

    private ActivityOrderHistoryBinding binding;
    private OrderHistoryAdapter adapter;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityOrderHistoryBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        setupViews();
        loadOrders();
    }

    private void setupViews() {
        binding.btnBack.setOnClickListener(v -> finish());

        adapter = new OrderHistoryAdapter(new ArrayList<>(), this);
        binding.rvOrders.setLayoutManager(new LinearLayoutManager(this));
        binding.rvOrders.setAdapter(adapter);
    }

    private void loadOrders() {
        setLoading(true);

        ApiClient.getInstance().getApiService().getMyOrders().enqueue(new Callback<List<Order>>() {
            @Override
            public void onResponse(Call<List<Order>> call, Response<List<Order>> response) {
                setLoading(false);

                if (response.isSuccessful() && response.body() != null) {
                    List<Order> orders = response.body();
                    if (orders.isEmpty()) {
                        showEmpty(true);
                    } else {
                        showEmpty(false);
                        adapter.updateData(orders);
                    }
                } else {
                    showEmpty(true);
                }
            }

            @Override
            public void onFailure(Call<List<Order>> call, Throwable t) {
                setLoading(false);
                showEmpty(true);
                Toast.makeText(OrderHistoryActivity.this, getString(R.string.error_network), Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void setLoading(boolean loading) {
        binding.progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
        if (loading) {
            binding.rvOrders.setVisibility(View.GONE);
            binding.layoutEmpty.setVisibility(View.GONE);
        }
    }

    private void showEmpty(boolean empty) {
        binding.layoutEmpty.setVisibility(empty ? View.VISIBLE : View.GONE);
        binding.rvOrders.setVisibility(empty ? View.GONE : View.VISIBLE);
    }

    @Override
    public void onOrderClick(Order order) {
        Intent intent = new Intent(this, OrderTrackingActivity.class);
        intent.putExtra("orderId", order.getId());
        startActivity(intent);
    }

    @Override
    public void onReorderClick(Order order) {
        Toast.makeText(this, "Reorder feature coming soon!", Toast.LENGTH_SHORT).show();
    }
}
