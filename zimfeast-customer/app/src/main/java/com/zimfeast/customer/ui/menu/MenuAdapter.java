package com.zimfeast.customer.ui.menu;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.zimfeast.customer.R;
import com.zimfeast.customer.data.model.MenuItem;
import com.zimfeast.customer.util.DeliveryUtils;

import java.util.List;

public class MenuAdapter extends RecyclerView.Adapter<MenuAdapter.ViewHolder> {

    private List<MenuItem> menuItems;
    private String currency;
    private final OnMenuItemClickListener listener;

    public interface OnMenuItemClickListener {
        void onAddToCart(MenuItem menuItem);
    }

    public MenuAdapter(List<MenuItem> menuItems, String currency, OnMenuItemClickListener listener) {
        this.menuItems = menuItems;
        this.currency = currency;
        this.listener = listener;
    }

    public void updateData(List<MenuItem> menuItems) {
        this.menuItems = menuItems;
        notifyDataSetChanged();
    }

    public void setCurrency(String currency) {
        this.currency = currency;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_menu, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        MenuItem item = menuItems.get(position);

        holder.tvName.setText(item.getName());
        holder.tvDescription.setText(item.getDescription() != null ? item.getDescription() : "");
        holder.tvPrice.setText(DeliveryUtils.formatCurrency(item.getPrice(), currency));

        if (item.getCategory() != null && !item.getCategory().isEmpty()) {
            holder.tvCategory.setText(item.getCategory());
            holder.tvCategory.setVisibility(View.VISIBLE);
        } else {
            holder.tvCategory.setVisibility(View.GONE);
        }

        if (!item.isAvailable()) {
            holder.tvUnavailable.setVisibility(View.VISIBLE);
            holder.btnAddToCart.setEnabled(false);
            holder.btnAddToCart.setAlpha(0.5f);
        } else {
            holder.tvUnavailable.setVisibility(View.GONE);
            holder.btnAddToCart.setEnabled(true);
            holder.btnAddToCart.setAlpha(1.0f);
        }

        if (item.getImageUrl() != null && !item.getImageUrl().isEmpty()) {
            Glide.with(holder.itemView.getContext())
                    .load(item.getImageUrl())
                    .placeholder(R.drawable.placeholder_restaurant)
                    .error(R.drawable.placeholder_restaurant)
                    .centerCrop()
                    .into(holder.ivImage);
        } else {
            holder.ivImage.setImageResource(R.drawable.placeholder_restaurant);
        }

        holder.btnAddToCart.setOnClickListener(v -> {
            if (listener != null && item.isAvailable()) {
                listener.onAddToCart(item);
            }
        });
    }

    @Override
    public int getItemCount() {
        return menuItems.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivImage;
        TextView tvName;
        TextView tvDescription;
        TextView tvCategory;
        TextView tvPrice;
        TextView tvUnavailable;
        Button btnAddToCart;

        ViewHolder(View view) {
            super(view);
            ivImage = view.findViewById(R.id.iv_item_image);
            tvName = view.findViewById(R.id.tv_item_name);
            tvDescription = view.findViewById(R.id.tv_item_description);
            tvCategory = view.findViewById(R.id.tv_category);
            tvPrice = view.findViewById(R.id.tv_price);
            tvUnavailable = view.findViewById(R.id.tv_unavailable);
            btnAddToCart = view.findViewById(R.id.btn_add_to_cart);
        }
    }
}
