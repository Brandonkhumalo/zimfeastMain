package com.zimfeast.driver.ui;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.zimfeast.driver.R;
import com.zimfeast.driver.data.model.Order;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

/**
 * RecyclerView.Adapter for displaying a list of historical orders.
 * Each item shows the order date, restaurant name, status, and driver earnings.
 */
public class OrderHistoryAdapter extends RecyclerView.Adapter<OrderHistoryAdapter.OrderViewHolder> {

    private List<Order> orders;

    // Date formats for parsing the API response and displaying to the user
    private final SimpleDateFormat inputFormat =
            new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
    private final SimpleDateFormat displayDateFormat =
            new SimpleDateFormat("MMM dd, yyyy", Locale.US);
    private final SimpleDateFormat displayTimeFormat =
            new SimpleDateFormat("hh:mm a", Locale.US);

    public OrderHistoryAdapter(List<Order> orders) {
        this.orders = orders;
    }

    /**
     * Replaces the current order list with new data and refreshes the RecyclerView.
     */
    public void updateOrders(List<Order> newOrders) {
        this.orders = newOrders;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public OrderViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        // Inflate the card layout for each order history item
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_order_history, parent, false);
        return new OrderViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull OrderViewHolder holder, int position) {
        Order order = orders.get(position);

        // Set restaurant name (could be multiple restaurants joined by comma)
        String restaurant = order.getRestaurantName();
        holder.tvRestaurant.setText(restaurant.isEmpty() ? "Unknown Restaurant" : restaurant);

        // Set delivery address
        String address = order.getDeliveryAddress();
        holder.tvAddress.setText(address != null ? address : "N/A");

        // Format and set the order date + time
        String created = order.getCreated();
        if (created != null && !created.isEmpty()) {
            try {
                // Parse ISO date string - handle both with and without timezone offset
                String cleanDate = created;
                if (cleanDate.contains("+")) {
                    cleanDate = cleanDate.substring(0, cleanDate.indexOf("+"));
                } else if (cleanDate.contains("Z")) {
                    cleanDate = cleanDate.replace("Z", "");
                }
                Date date = inputFormat.parse(cleanDate);
                if (date != null) {
                    holder.tvDate.setText(displayDateFormat.format(date));
                    holder.tvTime.setText(displayTimeFormat.format(date));
                }
            } catch (ParseException e) {
                // If parsing fails, show the raw date string trimmed
                holder.tvDate.setText(created.length() > 10 ? created.substring(0, 10) : created);
                holder.tvTime.setText("");
            }
        } else {
            holder.tvDate.setText("N/A");
            holder.tvTime.setText("");
        }

        // Format and display the order status with a human-readable label
        holder.tvStatus.setText(formatStatus(order.getStatus()));
        // Color-code the status text based on the status value
        holder.tvStatus.setTextColor(getStatusColor(order.getStatus()));

        // Show driver earnings (delivery fee + tip)
        holder.tvEarnings.setText(order.getFormattedEarnings());

        // Show order ID (shortened for display)
        String orderId = order.getId();
        if (orderId != null && orderId.length() > 8) {
            holder.tvOrderId.setText("#" + orderId.substring(0, 8));
        } else {
            holder.tvOrderId.setText("#" + (orderId != null ? orderId : "N/A"));
        }
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    /**
     * Converts a snake_case API status into a human-readable label.
     * e.g. "out_for_delivery" -> "Out For Delivery"
     */
    private String formatStatus(String status) {
        if (status == null || status.isEmpty()) return "Unknown";
        // Replace underscores with spaces and capitalize each word
        String[] words = status.replace("_", " ").split(" ");
        StringBuilder sb = new StringBuilder();
        for (String word : words) {
            if (!word.isEmpty()) {
                sb.append(Character.toUpperCase(word.charAt(0)))
                        .append(word.substring(1))
                        .append(" ");
            }
        }
        return sb.toString().trim();
    }

    /**
     * Returns a color int based on the order status for visual distinction.
     * Green for completed deliveries, orange for in-progress, red for cancelled.
     */
    private int getStatusColor(String status) {
        if (status == null) return 0xFF6B7280; // text_secondary grey
        switch (status) {
            case "delivered":
                return 0xFF22C55E; // success green
            case "cancelled":
            case "rejected":
                return 0xFFEF4444; // error red
            case "out_for_delivery":
            case "picked_up":
            case "preparing":
                return 0xFFF97316; // primary orange (in-progress)
            default:
                return 0xFF6B7280; // text_secondary grey
        }
    }

    /**
     * ViewHolder that holds references to the views in item_order_history.xml.
     */
    static class OrderViewHolder extends RecyclerView.ViewHolder {
        TextView tvRestaurant;
        TextView tvAddress;
        TextView tvDate;
        TextView tvTime;
        TextView tvStatus;
        TextView tvEarnings;
        TextView tvOrderId;

        OrderViewHolder(@NonNull View itemView) {
            super(itemView);
            tvRestaurant = itemView.findViewById(R.id.tv_order_restaurant);
            tvAddress = itemView.findViewById(R.id.tv_order_address);
            tvDate = itemView.findViewById(R.id.tv_order_date);
            tvTime = itemView.findViewById(R.id.tv_order_time);
            tvStatus = itemView.findViewById(R.id.tv_order_status);
            tvEarnings = itemView.findViewById(R.id.tv_order_earnings);
            tvOrderId = itemView.findViewById(R.id.tv_order_id);
        }
    }
}
