package com.zimfeast.driver.socket;

import android.util.Log;

import com.zimfeast.driver.ZimFeastDriverApp;
import com.zimfeast.driver.data.model.DeliveryOffer;

import org.json.JSONException;
import org.json.JSONObject;

import java.net.URISyntaxException;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

import io.socket.client.IO;
import io.socket.client.Socket;

public class SocketManager {
    
    private static final String TAG = "SocketManager";
    private static SocketManager instance;
    
    private Socket socket;
    private boolean isConnected = false;
    private boolean isRegistered = false;
    private List<SocketListener> listeners = new CopyOnWriteArrayList<>();
    private double pendingLat = 0;
    private double pendingLng = 0;
    
    private static final String SOCKET_URL = com.zimfeast.driver.BuildConfig.SOCKET_URL;
    private static final String SOCKET_NAMESPACE = "/drivers";
    
    public interface SocketListener {
        void onConnected();
        void onDisconnected();
        void onDeliveryOffer(DeliveryOffer offer);
        void onDeliveryAccepted(String orderId);
        void onDeliveryRejected(String orderId);
        void onError(String message);
    }
    
    private SocketManager() {
        try {
            IO.Options options = new IO.Options();
            options.forceNew = true;
            options.reconnection = true;
            options.reconnectionAttempts = Integer.MAX_VALUE; // Keep trying indefinitely
            options.reconnectionDelay = 1000;       // Start at 1s
            options.reconnectionDelayMax = 30000;   // Cap at 30s (exponential backoff)
            options.randomizationFactor = 0.5;      // Add jitter to prevent thundering herd
            options.timeout = 10000;
            
            socket = IO.socket(SOCKET_URL + "/drivers", options);
            if (socket != null) {
                setupSocketListeners();
            }
        } catch (URISyntaxException e) {
            Log.e(TAG, "Socket URI error: " + e.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Socket init error: " + e.getMessage());
        }
    }
    
    public static synchronized SocketManager getInstance() {
        if (instance == null) {
            instance = new SocketManager();
        }
        return instance;
    }
    
    public void addListener(SocketListener listener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener);
        }
    }
    
    public void removeListener(SocketListener listener) {
        listeners.remove(listener);
    }
    
    private void setupSocketListeners() {
        socket.on(Socket.EVENT_CONNECT, args -> {
            Log.d(TAG, "Socket connected");
            isConnected = true;
            isRegistered = false;
            // Don't register immediately - wait for location
            for (SocketListener l : listeners) l.onConnected();
        });
        
        socket.on(Socket.EVENT_DISCONNECT, args -> {
            Log.d(TAG, "Socket disconnected");
            isConnected = false;
            isRegistered = false;
            for (SocketListener l : listeners) l.onDisconnected();
        });
        
        socket.on(Socket.EVENT_CONNECT_ERROR, args -> {
            Log.e(TAG, "Socket connection error");
            for (SocketListener l : listeners) l.onError("Connection failed");
        });
        
        socket.on("delivery:offer", args -> {
            try {
                JSONObject data = (JSONObject) args[0];
                DeliveryOffer offer = parseDeliveryOffer(data);
                Log.d(TAG, "Received delivery offer: " + offer.getOrderId());
                for (SocketListener l : listeners) l.onDeliveryOffer(offer);
            } catch (Exception e) {
                Log.e(TAG, "Error parsing delivery offer: " + e.getMessage());
            }
        });
        
        socket.on("delivery:accepted", args -> {
            try {
                JSONObject data = (JSONObject) args[0];
                String orderId = data.getString("orderId");
                for (SocketListener l : listeners) l.onDeliveryAccepted(orderId);
            } catch (JSONException e) {
                Log.e(TAG, "Error parsing accepted: " + e.getMessage());
            }
        });
        
        socket.on("delivery:accept_failed", args -> {
            try {
                JSONObject data = (JSONObject) args[0];
                String message = data.optString("message", "Failed to accept");
                for (SocketListener l : listeners) l.onError(message);
            } catch (Exception e) {
                Log.e(TAG, "Error: " + e.getMessage());
            }
        });
        
        socket.on("delivery:rejected", args -> {
            try {
                JSONObject data = (JSONObject) args[0];
                String orderId = data.getString("orderId");
                for (SocketListener l : listeners) l.onDeliveryRejected(orderId);
            } catch (JSONException e) {
                Log.e(TAG, "Error: " + e.getMessage());
            }
        });
        
        socket.on("driver:registered", args -> {
            Log.d(TAG, "Driver registered successfully");
        });
        
        socket.on("error", args -> {
            try {
                JSONObject data = (JSONObject) args[0];
                String message = data.optString("message", "Unknown error");
                for (SocketListener l : listeners) l.onError(message);
            } catch (Exception e) {
                Log.e(TAG, "Error: " + e.getMessage());
            }
        });
    }
    
    private DeliveryOffer parseDeliveryOffer(JSONObject data) throws JSONException {
        DeliveryOffer offer = new DeliveryOffer();
        offer.setOrderId(data.getString("orderId"));
        offer.setRestaurantName(data.optString("restaurantName", ""));
        offer.setRestaurantAddress(data.optString("restaurantAddress", ""));
        offer.setRestaurantLat(data.optDouble("restaurantLat", 0));
        offer.setRestaurantLng(data.optDouble("restaurantLng", 0));
        offer.setCustomerName(data.optString("customerName", "Customer"));
        offer.setCustomerPhone(data.optString("customerPhone", ""));
        offer.setDropoffAddress(data.optString("dropoffAddress", ""));
        offer.setDropoffLat(data.optDouble("dropoffLat", 0));
        offer.setDropoffLng(data.optDouble("dropoffLng", 0));
        offer.setDistanceToRestaurant(data.optString("distanceToRestaurant", "0"));
        offer.setDistanceToCustomer(data.optString("distanceToCustomer", "0"));
        offer.setTotalDistance(data.optString("totalDistance", "0"));
        offer.setDeliveryPrice(data.optString("deliveryPrice", "0"));
        offer.setTotal(data.optDouble("total", 0));
        offer.setTip(data.optDouble("tip", 0));
        offer.setExpiresIn(data.optInt("expiresIn", 30));
        return offer;
    }
    
    public void connect() {
        if (!isConnected && socket != null) {
            Log.d(TAG, "Connecting to socket...");
            socket.connect();
        }
    }
    
    public void disconnect() {
        if (socket != null) {
            Log.d(TAG, "Disconnecting socket...");
            socket.disconnect();
            isConnected = false;
            isRegistered = false;
        }
    }
    
    public void registerDriverWithLocation(double lat, double lng) {
        if (!isConnected || socket == null) {
            // Save for later when connected
            pendingLat = lat;
            pendingLng = lng;
            return;
        }
        
        ZimFeastDriverApp app = ZimFeastDriverApp.getInstance();
        JSONObject data = new JSONObject();
        try {
            data.put("driverId", app.getDriverId());
            data.put("name", app.getDriverName());
            data.put("phone", app.getDriverPhone());
            data.put("vehicle", app.getDriverVehicle());
            data.put("lat", lat);
            data.put("lng", lng);
            socket.emit("driver:register", data);
            isRegistered = true;
            Log.d(TAG, "Driver registered at " + lat + ", " + lng);
        } catch (JSONException e) {
            Log.e(TAG, "Error registering driver: " + e.getMessage());
        }
    }
    
    public boolean isRegistered() {
        return isRegistered;
    }
    
    public void updateLocation(double lat, double lng) {
        if (isConnected && socket != null) {
            // Register with location if not yet registered
            if (!isRegistered) {
                registerDriverWithLocation(lat, lng);
                return;
            }
            
            JSONObject data = new JSONObject();
            try {
                data.put("lat", lat);
                data.put("lng", lng);
                socket.emit("driver:location_update", data);
            } catch (JSONException e) {
                Log.e(TAG, "Error updating location: " + e.getMessage());
            }
        }
    }
    
    public void acceptDelivery(String orderId) {
        if (isConnected && socket != null) {
            JSONObject data = new JSONObject();
            try {
                data.put("orderId", orderId);
                socket.emit("delivery:accept", data);
            } catch (JSONException e) {
                Log.e(TAG, "Error accepting delivery: " + e.getMessage());
            }
        }
    }
    
    public void rejectDelivery(String orderId, String reason) {
        if (isConnected && socket != null) {
            JSONObject data = new JSONObject();
            try {
                data.put("orderId", orderId);
                data.put("reason", reason);
                socket.emit("delivery:reject", data);
            } catch (JSONException e) {
                Log.e(TAG, "Error rejecting delivery: " + e.getMessage());
            }
        }
    }
    
    public void updateDeliveryStatus(String orderId, String status) {
        if (isConnected && socket != null) {
            JSONObject data = new JSONObject();
            try {
                data.put("orderId", orderId);
                data.put("status", status);
                socket.emit("delivery:status", data);
            } catch (JSONException e) {
                Log.e(TAG, "Error updating status: " + e.getMessage());
            }
        }
    }
    
    public void goOnline() {
        if (isConnected && socket != null) {
            socket.emit("driver:go_online");
        }
    }
    
    public void goOffline() {
        if (isConnected && socket != null) {
            Log.d(TAG, "Going offline...");
            socket.emit("driver:go_offline");
        }
    }
    
    public void goOfflineAndDisconnect() {
        if (isConnected && socket != null) {
            Log.d(TAG, "Going offline and disconnecting...");
            socket.emit("driver:go_offline");
            // Small delay to ensure the offline message is sent before disconnect
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                disconnect();
            }, 200);
        } else {
            disconnect();
        }
    }
    
    public boolean isConnected() {
        return isConnected;
    }
}
