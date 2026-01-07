package com.zimfeast.driver.socket;

import android.util.Log;

import com.zimfeast.driver.BuildConfig;
import com.zimfeast.driver.ZimFeastDriverApp;
import com.zimfeast.driver.data.model.DeliveryOffer;

import org.json.JSONException;
import org.json.JSONObject;

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;

import io.socket.client.IO;
import io.socket.client.Socket;
import io.socket.emitter.Emitter;

public class SocketManager {
    
    private static final String TAG = "SocketManager";
    private static SocketManager instance;
    
    private Socket socket;
    private boolean isConnected = false;
    private List<SocketListener> listeners = new ArrayList<>();
    
    private static final String SOCKET_URL = "https://your-app.replit.app:3001";
    
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
            options.reconnectionAttempts = 10;
            options.reconnectionDelay = 1000;
            options.timeout = 10000;
            
            socket = IO.socket(SOCKET_URL + "/drivers", options);
            setupSocketListeners();
        } catch (URISyntaxException e) {
            Log.e(TAG, "Socket URI error: " + e.getMessage());
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
            registerDriver();
            for (SocketListener l : listeners) l.onConnected();
        });
        
        socket.on(Socket.EVENT_DISCONNECT, args -> {
            Log.d(TAG, "Socket disconnected");
            isConnected = false;
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
        offer.setRestaurantName(data.getString("restaurantName"));
        offer.setRestaurantLat(data.getDouble("restaurantLat"));
        offer.setRestaurantLng(data.getDouble("restaurantLng"));
        offer.setDropoffAddress(data.getString("dropoffAddress"));
        offer.setDropoffLat(data.getDouble("dropoffLat"));
        offer.setDropoffLng(data.getDouble("dropoffLng"));
        offer.setDistance(data.optString("distance", "0"));
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
            socket.disconnect();
            isConnected = false;
        }
    }
    
    private void registerDriver() {
        ZimFeastDriverApp app = ZimFeastDriverApp.getInstance();
        JSONObject data = new JSONObject();
        try {
            data.put("driverId", app.getDriverId());
            data.put("name", app.getDriverName());
            data.put("phone", app.getDriverPhone());
            data.put("vehicle", app.getDriverVehicle());
            data.put("lat", 0);
            data.put("lng", 0);
            socket.emit("driver:register", data);
        } catch (JSONException e) {
            Log.e(TAG, "Error registering driver: " + e.getMessage());
        }
    }
    
    public void updateLocation(double lat, double lng) {
        if (isConnected && socket != null) {
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
            socket.emit("driver:go_offline");
        }
    }
    
    public boolean isConnected() {
        return isConnected;
    }
}
