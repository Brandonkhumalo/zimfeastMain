package com.zimfeast.customer.ui.customer;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.zimfeast.customer.R;

import java.util.List;

public class CuisineFilterAdapter extends RecyclerView.Adapter<CuisineFilterAdapter.ViewHolder> {

    private final List<CustomerActivity.CuisineFilter> cuisines;
    private final OnCuisineSelectedListener listener;
    private int selectedPosition = 0;

    public interface OnCuisineSelectedListener {
        void onCuisineSelected(String cuisine);
    }

    public CuisineFilterAdapter(List<CustomerActivity.CuisineFilter> cuisines, OnCuisineSelectedListener listener) {
        this.cuisines = cuisines;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_cuisine_filter, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        CustomerActivity.CuisineFilter cuisine = cuisines.get(position);
        holder.tvLabel.setText(cuisine.label);

        boolean isSelected = position == selectedPosition;
        holder.itemView.setSelected(isSelected);
        holder.tvLabel.setTextColor(holder.itemView.getContext().getColor(
                isSelected ? R.color.on_primary : R.color.primary
        ));
        holder.itemView.setBackgroundResource(
                isSelected ? R.drawable.bg_chip_selected : R.drawable.bg_chip_outline
        );

        holder.itemView.setOnClickListener(v -> {
            int oldPosition = selectedPosition;
            selectedPosition = holder.getAdapterPosition();
            notifyItemChanged(oldPosition);
            notifyItemChanged(selectedPosition);
            if (listener != null) {
                listener.onCuisineSelected(cuisine.key);
            }
        });
    }

    @Override
    public int getItemCount() {
        return cuisines.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvLabel;

        ViewHolder(View view) {
            super(view);
            tvLabel = view.findViewById(R.id.tv_cuisine_label);
        }
    }
}
