package com.zimfeast.customer.ui.customer;

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
import com.zimfeast.customer.data.model.Restaurant;
import com.zimfeast.customer.util.DeliveryUtils;

import java.util.List;

public class RestaurantAdapter extends RecyclerView.Adapter<RestaurantAdapter.ViewHolder> {

    private List<Restaurant> restaurants;
    private String currency;
    private final OnRestaurantClickListener listener;
    private double userLat = 0;
    private double userLng = 0;

    public interface OnRestaurantClickListener {
        void onAddToCart(Restaurant restaurant);
    }

    public RestaurantAdapter(List<Restaurant> restaurants, String currency, OnRestaurantClickListener listener) {
        this.restaurants = restaurants;
        this.currency = currency;
        this.listener = listener;
    }

    public void updateData(List<Restaurant> restaurants) {
        this.restaurants = restaurants;
        notifyDataSetChanged();
    }

    public void setCurrency(String currency) {
        this.currency = currency;
        notifyDataSetChanged();
    }

    public void setUserLocation(double lat, double lng) {
        this.userLat = lat;
        this.userLng = lng;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_restaurant, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Restaurant restaurant = restaurants.get(position);

        holder.tvName.setText(restaurant.getName());
        holder.tvCuisine.setText(restaurant.getFormattedCuisine());
        holder.tvRating.setText(String.format("%.1f", restaurant.getRating() > 0 ? restaurant.getRating() : 4.5));
        holder.tvDeliveryTime.setText(restaurant.getDeliveryTimeRange());

        double deliveryFee = DeliveryUtils.DEFAULT_DELIVERY_FEE;
        if (userLat != 0 && userLng != 0 && restaurant.getCoordinates() != null) {
            deliveryFee = DeliveryUtils.calculateDeliveryFee(
                    userLat, userLng,
                    restaurant.getCoordinates().getLat(),
                    restaurant.getCoordinates().getLng()
            );
        }
        holder.tvDeliveryFee.setText(DeliveryUtils.formatCurrency(deliveryFee, currency) + " delivery");

        if (restaurant.getImageUrl() != null && !restaurant.getImageUrl().isEmpty()) {
            Glide.with(holder.itemView.getContext())
                    .load(restaurant.getImageUrl())
                    .placeholder(R.drawable.placeholder_restaurant)
                    .error(R.drawable.placeholder_restaurant)
                    .centerCrop()
                    .into(holder.ivImage);
        } else {
            holder.ivImage.setImageResource(R.drawable.placeholder_restaurant);
        }

        holder.btnViewMenu.setOnClickListener(v -> {
            if (listener != null) {
                listener.onAddToCart(restaurant);
            }
        });
    }

    @Override
    public int getItemCount() {
        return restaurants.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivImage;
        TextView tvName;
        TextView tvCuisine;
        TextView tvRating;
        TextView tvDeliveryTime;
        TextView tvDeliveryFee;
        Button btnViewMenu;

        ViewHolder(View view) {
            super(view);
            ivImage = view.findViewById(R.id.iv_restaurant_image);
            tvName = view.findViewById(R.id.tv_restaurant_name);
            tvCuisine = view.findViewById(R.id.tv_cuisine);
            tvRating = view.findViewById(R.id.tv_rating);
            tvDeliveryTime = view.findViewById(R.id.tv_delivery_time);
            tvDeliveryFee = view.findViewById(R.id.tv_delivery_fee);
            btnViewMenu = view.findViewById(R.id.btn_view_menu);
        }
    }
}
