package com.zimfeast.customer.data.local;

import androidx.lifecycle.LiveData;
import androidx.room.Dao;
import androidx.room.Delete;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Update;

import com.zimfeast.customer.data.model.CartItem;

import java.util.List;

@Dao
public interface CartDao {
    @Query("SELECT * FROM cart_items")
    LiveData<List<CartItem>> getAllItems();

    @Query("SELECT * FROM cart_items")
    List<CartItem> getAllItemsSync();

    @Query("SELECT * FROM cart_items WHERE id = :id")
    CartItem getItemById(String id);

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insert(CartItem item);

    @Update
    void update(CartItem item);

    @Delete
    void delete(CartItem item);

    @Query("DELETE FROM cart_items")
    void clearCart();

    @Query("SELECT SUM(price * quantity) FROM cart_items")
    LiveData<Double> getSubtotal();

    @Query("SELECT COUNT(*) FROM cart_items")
    LiveData<Integer> getItemCount();
}
