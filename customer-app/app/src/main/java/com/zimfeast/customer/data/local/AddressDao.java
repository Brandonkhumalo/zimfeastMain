package com.zimfeast.customer.data.local;

import androidx.lifecycle.LiveData;
import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;
import androidx.room.Delete;

import com.zimfeast.customer.data.model.Address;

import java.util.List;

/**
 * Data Access Object for cached addresses. When the user opens the address book
 * we show the cached list instantly and refresh from the API in the background.
 */
@Dao
public interface AddressDao {

    /** Observe all cached addresses (sorted newest first). */
    @Query("SELECT * FROM addresses ORDER BY created DESC")
    LiveData<List<Address>> getAllAddresses();

    /** Blocking read for background threads. */
    @Query("SELECT * FROM addresses ORDER BY created DESC")
    List<Address> getAllAddressesSync();

    /** Insert or replace addresses (used when refreshing from API). */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insertAll(List<Address> addresses);

    /** Insert a single address. */
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void insert(Address address);

    /** Delete a specific address by entity. */
    @Delete
    void delete(Address address);

    /** Delete an address by its server ID. */
    @Query("DELETE FROM addresses WHERE id = :addressId")
    void deleteById(String addressId);

    /** Remove all cached addresses (used before a full refresh). */
    @Query("DELETE FROM addresses")
    void clearAll();
}
