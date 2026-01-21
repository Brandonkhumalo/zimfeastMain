package com.zimfeast.customer.ui.address;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.libraries.places.api.model.AutocompletePrediction;
import com.zimfeast.customer.R;

import java.util.ArrayList;
import java.util.List;

public class AddressSuggestionAdapter extends RecyclerView.Adapter<AddressSuggestionAdapter.ViewHolder> {

    private List<AutocompletePrediction> suggestions = new ArrayList<>();
    private final OnSuggestionClickListener listener;

    public interface OnSuggestionClickListener {
        void onSuggestionClick(AutocompletePrediction prediction);
    }

    public AddressSuggestionAdapter(OnSuggestionClickListener listener) {
        this.listener = listener;
    }

    public void updateSuggestions(List<AutocompletePrediction> newSuggestions) {
        this.suggestions = newSuggestions != null ? newSuggestions : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_address_suggestion, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        AutocompletePrediction prediction = suggestions.get(position);
        holder.bind(prediction);
    }

    @Override
    public int getItemCount() {
        return suggestions.size();
    }

    class ViewHolder extends RecyclerView.ViewHolder {
        private final TextView tvPrimaryText;
        private final TextView tvSecondaryText;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            tvPrimaryText = itemView.findViewById(R.id.tvPrimaryText);
            tvSecondaryText = itemView.findViewById(R.id.tvSecondaryText);
        }

        void bind(AutocompletePrediction prediction) {
            tvPrimaryText.setText(prediction.getPrimaryText(null));
            tvSecondaryText.setText(prediction.getSecondaryText(null));
            
            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onSuggestionClick(prediction);
                }
            });
        }
    }
}
