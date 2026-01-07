package com.zimfeast.customer.ui.history;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.zimfeast.customer.R;
import com.zimfeast.customer.data.model.Order;
import com.zimfeast.customer.util.DeliveryUtils;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class OrderHistoryAdapter extends RecyclerView.Adapter<OrderHistoryAdapter.ViewHolder> {

    private List<Order> orders;
    private final OnOrderClickListener listener;

    public interface OnOrderClickListener {
        void onOrderClick(Order order);
        void onReorderClick(Order order);
    }

    public OrderHistoryAdapter(List<Order> orders, OnOrderClickListener listener) {
        this.orders = orders;
        this.listener = listener;
    }

    public void updateData(List<Order> orders) {
        this.orders = orders;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_order_history, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Order order = orders.get(position);

        String orderNumber = order.getId();
        if (orderNumber != null && orderNumber.length() > 8) {
            orderNumber = orderNumber.substring(0, 8).toUpperCase();
        }
        holder.tvOrderNumber.setText("Order #" + orderNumber);

        holder.tvRestaurantName.setText(order.getRestaurantName() != null ? order.getRestaurantName() : "Restaurant");

        String itemsText = formatOrderItems(order);
        holder.tvItems.setText(itemsText);

        String status = order.getStatus() != null ? order.getStatus() : "pending";
        holder.tvStatus.setText(formatStatus(status));
        setStatusColor(holder.tvStatus, status);

        String currency = order.getCurrency() != null ? order.getCurrency() : "USD";
        holder.tvTotal.setText(DeliveryUtils.formatCurrency(order.getTotal(), currency));

        if (order.getCreatedAt() != null) {
            holder.tvDate.setText(formatDate(order.getCreatedAt()));
        } else {
            holder.tvDate.setText("Recent");
        }

        holder.itemView.setOnClickListener(v -> {
            if (listener != null) {
                listener.onOrderClick(order);
            }
        });

        holder.btnReorder.setOnClickListener(v -> {
            if (listener != null) {
                listener.onReorderClick(order);
            }
        });
    }

    private String formatOrderItems(Order order) {
        if (order.getItems() == null || order.getItems().isEmpty()) {
            return "Items not available";
        }

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < order.getItems().size() && i < 3; i++) {
            Order.OrderItem item = order.getItems().get(i);
            if (i > 0) sb.append(", ");
            sb.append(item.getQuantity()).append("x ").append(item.getName());
        }
        if (order.getItems().size() > 3) {
            sb.append(" +").append(order.getItems().size() - 3).append(" more");
        }
        return sb.toString();
    }

    private String formatStatus(String status) {
        switch (status.toLowerCase()) {
            case "delivered": return "Delivered";
            case "out_for_delivery": return "On the way";
            case "preparing": return "Preparing";
            case "ready": return "Ready";
            case "collected": return "Collected";
            case "paid": return "Paid";
            case "cancelled": return "Cancelled";
            default: return "Pending";
        }
    }

    private void setStatusColor(TextView textView, String status) {
        int color;
        switch (status.toLowerCase()) {
            case "delivered":
            case "collected":
                color = Color.parseColor("#10B981");
                break;
            case "out_for_delivery":
            case "preparing":
            case "ready":
                color = Color.parseColor("#F59E0B");
                break;
            case "cancelled":
                color = Color.parseColor("#EF4444");
                break;
            default:
                color = Color.parseColor("#6B7280");
        }

        GradientDrawable bg = (GradientDrawable) textView.getBackground();
        if (bg != null) {
            bg.setColor(color);
        }
    }

    private String formatDate(String dateStr) {
        try {
            SimpleDateFormat inputFormat = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            SimpleDateFormat outputFormat = new SimpleDateFormat("MMM d, yyyy", Locale.US);
            Date date = inputFormat.parse(dateStr);
            return outputFormat.format(date);
        } catch (Exception e) {
            return dateStr;
        }
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvOrderNumber;
        TextView tvRestaurantName;
        TextView tvItems;
        TextView tvStatus;
        TextView tvDate;
        TextView tvTotal;
        Button btnReorder;

        ViewHolder(View view) {
            super(view);
            tvOrderNumber = view.findViewById(R.id.tv_order_number);
            tvRestaurantName = view.findViewById(R.id.tv_restaurant_name);
            tvItems = view.findViewById(R.id.tv_items);
            tvStatus = view.findViewById(R.id.tv_status);
            tvDate = view.findViewById(R.id.tv_date);
            tvTotal = view.findViewById(R.id.tv_total);
            btnReorder = view.findViewById(R.id.btn_reorder);
        }
    }
}
