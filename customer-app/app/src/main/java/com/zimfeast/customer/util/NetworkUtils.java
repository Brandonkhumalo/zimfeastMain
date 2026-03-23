package com.zimfeast.customer.util;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;

import androidx.annotation.NonNull;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

/**
 * Monitors network connectivity and exposes state as LiveData.
 * Usage:
 *   NetworkUtils.init(context);
 *   NetworkUtils.isOnline().observe(this, online -> { ... });
 */
public class NetworkUtils {

    private static final MutableLiveData<Boolean> onlineLiveData = new MutableLiveData<>(true);
    private static boolean initialized = false;

    public static void init(@NonNull Context context) {
        if (initialized) return;
        initialized = true;

        ConnectivityManager cm = (ConnectivityManager)
                context.getApplicationContext().getSystemService(Context.CONNECTIVITY_SERVICE);
        if (cm == null) return;

        Network activeNetwork = cm.getActiveNetwork();
        if (activeNetwork != null) {
            NetworkCapabilities caps = cm.getNetworkCapabilities(activeNetwork);
            onlineLiveData.postValue(caps != null &&
                    caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET));
        } else {
            onlineLiveData.postValue(false);
        }

        NetworkRequest request = new NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                .build();

        cm.registerNetworkCallback(request, new ConnectivityManager.NetworkCallback() {
            @Override
            public void onAvailable(@NonNull Network network) {
                onlineLiveData.postValue(true);
            }

            @Override
            public void onLost(@NonNull Network network) {
                onlineLiveData.postValue(false);
            }
        });
    }

    public static LiveData<Boolean> isOnline() {
        return onlineLiveData;
    }

    public static boolean isCurrentlyOnline() {
        Boolean value = onlineLiveData.getValue();
        return value != null && value;
    }
}
