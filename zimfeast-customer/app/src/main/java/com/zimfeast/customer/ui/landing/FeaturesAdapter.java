package com.zimfeast.customer.ui.landing;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.zimfeast.customer.R;

import java.util.List;

public class FeaturesAdapter extends RecyclerView.Adapter<FeaturesAdapter.ViewHolder> {

    private final List<LandingActivity.Feature> features;

    public FeaturesAdapter(List<LandingActivity.Feature> features) {
        this.features = features;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_feature, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        LandingActivity.Feature feature = features.get(position);
        holder.tvTitle.setText(feature.title);
        holder.tvDescription.setText(feature.description);

        int iconRes;
        switch (feature.icon) {
            case "delivery":
                iconRes = R.drawable.ic_delivery;
                break;
            case "restaurant":
                iconRes = R.drawable.ic_restaurant;
                break;
            case "security":
                iconRes = R.drawable.ic_security;
                break;
            default:
                iconRes = R.drawable.ic_restaurant;
        }
        holder.ivIcon.setImageResource(iconRes);
    }

    @Override
    public int getItemCount() {
        return features.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        ImageView ivIcon;
        TextView tvTitle;
        TextView tvDescription;

        ViewHolder(View view) {
            super(view);
            ivIcon = view.findViewById(R.id.iv_icon);
            tvTitle = view.findViewById(R.id.tv_title);
            tvDescription = view.findViewById(R.id.tv_description);
        }
    }
}
