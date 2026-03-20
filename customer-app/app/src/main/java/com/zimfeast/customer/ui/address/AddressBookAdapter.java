package com.zimfeast.customer.ui.address;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageButton;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.zimfeast.customer.R;
import com.zimfeast.customer.data.model.Address;

import java.util.List;

/**
 * RecyclerView adapter for the address book list. Displays each saved address
 * with label, address text, and edit/delete action buttons.  In select mode
 * (used during checkout), the action buttons are hidden and tapping the whole
 * card triggers selection.
 */
public class AddressBookAdapter extends RecyclerView.Adapter<AddressBookAdapter.ViewHolder> {

    private List<Address> addresses;
    private final OnAddressActionListener listener;
    private final boolean selectMode;

    public interface OnAddressActionListener {
        void onAddressClick(Address address);
        void onEditClick(Address address);
        void onDeleteClick(Address address);
    }

    public AddressBookAdapter(List<Address> addresses, OnAddressActionListener listener, boolean selectMode) {
        this.addresses = addresses;
        this.listener = listener;
        this.selectMode = selectMode;
    }

    public void updateData(List<Address> addresses) {
        this.addresses = addresses;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_address, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        Address address = addresses.get(position);

        holder.tvLabel.setText(address.getLabel() != null ? address.getLabel() : "Address");
        holder.tvAddressText.setText(address.getAddressText() != null ? address.getAddressText() : "");

        holder.itemView.setOnClickListener(v -> {
            if (listener != null) listener.onAddressClick(address);
        });

        if (selectMode) {
            holder.btnEdit.setVisibility(View.GONE);
            holder.btnDelete.setVisibility(View.GONE);
        } else {
            holder.btnEdit.setVisibility(View.VISIBLE);
            holder.btnDelete.setVisibility(View.VISIBLE);

            holder.btnEdit.setOnClickListener(v -> {
                if (listener != null) listener.onEditClick(address);
            });

            holder.btnDelete.setOnClickListener(v -> {
                if (listener != null) listener.onDeleteClick(address);
            });
        }
    }

    @Override
    public int getItemCount() {
        return addresses.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView tvLabel;
        TextView tvAddressText;
        ImageButton btnEdit;
        ImageButton btnDelete;

        ViewHolder(View view) {
            super(view);
            tvLabel = view.findViewById(R.id.tv_address_label);
            tvAddressText = view.findViewById(R.id.tv_address_text);
            btnEdit = view.findViewById(R.id.btn_edit_address);
            btnDelete = view.findViewById(R.id.btn_delete_address);
        }
    }
}
