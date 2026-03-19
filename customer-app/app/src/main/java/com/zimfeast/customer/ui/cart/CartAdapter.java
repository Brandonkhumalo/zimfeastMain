package com.zimfeast.customer.ui.cart;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.zimfeast.customer.R;
import com.zimfeast.customer.data.model.CartItem;
import com.zimfeast.customer.util.DeliveryUtils;

import java.util.List;

public class CartAdapter extends RecyclerView.Adapter<CartAdapter.ViewHolder> {

    private List<CartItem> items;
    private final OnCartItemListener listener;

    public interface OnCartItemListener {
        void onQuantityChanged(CartItem item, int newQuantity);
        void onRemoveItem(CartItem item);
    }

    public CartAdapter(List<CartItem> items, OnCartItemListener listener) {
        this.items = items;
        this.listener = listener;
    }

    public void updateData(List<CartItem> items) {
        this.items = items;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_cart, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        CartItem item = items.get(position);

        holder.tvName.setText(item.getName());
        holder.tvRestaurant.setText(item.getRestaurantName());
        holder.tvPrice.setText(DeliveryUtils.formatCurrency(item.getPrice(), "USD"));
        holder.tvQuantity.setText(String.valueOf(item.getQuantity()));
        holder.tvTotal.setText(DeliveryUtils.formatCurrency(item.getTotalPrice(), "USD"));

        holder.btnDecrease.setOnClickListener(v -> {
            if (listener != null) {
                listener.onQuantityChanged(item, item.getQuantity() - 1);
            }
        });

        holder.btnIncrease.setOnClickListener(v -> {
            if (listener != null) {
                listener.onQuantityChanged(item, item.getQuantity() + 1);
            }
        });

        holder.btnRemove.setOnClickListener(v -> {
            if (listener != null) {
                listener.onRemoveItem(item);
            }
        });
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvName;
        TextView tvRestaurant;
        TextView tvPrice;
        TextView tvQuantity;
        TextView tvTotal;
        ImageButton btnDecrease;
        ImageButton btnIncrease;
        ImageButton btnRemove;

        ViewHolder(View view) {
            super(view);
            tvName = view.findViewById(R.id.tv_item_name);
            tvRestaurant = view.findViewById(R.id.tv_restaurant_name);
            tvPrice = view.findViewById(R.id.tv_item_price);
            tvQuantity = view.findViewById(R.id.tv_quantity);
            tvTotal = view.findViewById(R.id.tv_item_total);
            btnDecrease = view.findViewById(R.id.btn_decrease);
            btnIncrease = view.findViewById(R.id.btn_increase);
            btnRemove = view.findViewById(R.id.btn_remove);
        }
    }
}
