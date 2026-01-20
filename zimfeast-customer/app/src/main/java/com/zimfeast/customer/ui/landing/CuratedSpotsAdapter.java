package com.zimfeast.customer.ui.landing;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.zimfeast.customer.R;

import java.util.List;

public class CuratedSpotsAdapter extends RecyclerView.Adapter<CuratedSpotsAdapter.ViewHolder> {

    private final List<LandingActivity.CuratedSpot> spots;
    private final OnSpotClickListener listener;

    public interface OnSpotClickListener {
        void onSpotClick();
    }

    public CuratedSpotsAdapter(List<LandingActivity.CuratedSpot> spots, OnSpotClickListener listener) {
        this.spots = spots;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_curated_spot, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        LandingActivity.CuratedSpot spot = spots.get(position);

        holder.tvName.setText(spot.name);
        holder.tvCuisine.setText(spot.cuisine);
        holder.tvRating.setText(String.format("%.1f", spot.rating));

        Glide.with(holder.itemView.getContext())
                .load(spot.imageUrl)
                .centerCrop()
                .into(holder.ivImage);

        holder.itemView.setOnClickListener(v -> {
            if (listener != null) {
                listener.onSpotClick();
            }
        });
    }

    @Override
    public int getItemCount() {
        return spots.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivImage;
        TextView tvName;
        TextView tvCuisine;
        TextView tvRating;

        ViewHolder(View view) {
            super(view);
            ivImage = view.findViewById(R.id.iv_spot_image);
            tvName = view.findViewById(R.id.tv_spot_name);
            tvCuisine = view.findViewById(R.id.tv_spot_cuisine);
            tvRating = view.findViewById(R.id.tv_spot_rating);
        }
    }
}
