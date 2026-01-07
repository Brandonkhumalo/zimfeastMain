package com.zimfeast.customer.socket;

import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.List;

import io.socket.client.IO;
import io.socket.client.Socket;

public class TrackingSocketManager {
    
    private static final String TAG = "TrackingSocketManager";
    private static TrackingSocketManager instance;
    
    private Socket socket;
    private boolean isConnected = false;
    private List<TrackingListener> listeners = new ArrayList<>();
    
    private static final String SOCKET_URL = "https://your-app.replit.app:3001";
    
    public interface TrackingListener {
        void onDriverAssigned(String driverId, String name, String phone, String vehicle, double lat, double lng);
        void onDriverLocation(double lat, double lng);
        void onOrderStatus(String status);
        void onETA(int minutes, String distance);
        void onDeliveryCompleted(boolean requestRating);
        void onNoDriversAvailable();
    }
    
    private TrackingSocketManager() {
        try {
            IO.Options options = new IO.Options();
            options.forceNew = true;
            options.reconnection = true;
            options.reconnectionAttempts = 10;
            options.timeout = 10000;
            
            socket = IO.socket(SOCKET_URL + "/customers", options);
            setupSocketListeners();
        } catch (URISyntaxException e) {
            Log.e(TAG, "Socket URI error: " + e.getMessage());
        }
    }
    
    public static synchronized TrackingSocketManager getInstance() {
        if (instance == null) {
            instance = new TrackingSocketManager();
        }
        return instance;
    }
    
    public void addListener(TrackingListener listener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener);
        }
    }
    
    public void removeListener(TrackingListener listener) {
        listeners.remove(listener);
    }
    
    private void setupSocketListeners() {
        socket.on(Socket.EVENT_CONNECT, args -> {
            Log.d(TAG, "Tracking socket connected");
            isConnected = true;
        });
        
        socket.on(Socket.EVENT_DISCONNECT, args -> {
            Log.d(TAG, "Tracking socket disconnected");
            isConnected = false;
        });
        
        socket.on("order:driver_assigned", args -> {
            try {
                JSONObject data = (JSONObject) args[0];
                JSONObject driver = data.getJSONObject("driver");
                String driverId = driver.getString("id");
                String name = driver.optString("name", "Driver");
                String phone = driver.optString("phone", "");
                String vehicle = driver.optString("vehicle", "Car");
                double lat = driver.optDouble("lat", 0);
                double lng = driver.optDouble("lng", 0);
                
                for (TrackingListener l : listeners) {
                    l.onDriverAssigned(driverId, name, phone, vehicle, lat, lng);
                }
            } catch (JSONException e) {
                Log.e(TAG, "Error parsing driver assigned: " + e.getMessage());
            }
        });
        
        socket.on("driver:location", args -> {
            try {
                JSONObject data = (JSONObject) args[0];
                double lat = data.getDouble("lat");
                double lng = data.getDouble("lng");
                
                for (TrackingListener l : listeners) {
                    l.onDriverLocation(lat, lng);
                }
            } catch (JSONException e) {
                Log.e(TAG, "Error parsing driver location: " + e.getMessage());
            }
        });
        
        socket.on("order:status", args -> {
            try {
                JSONObject data = (JSONObject) args[0];
                String status = data.getString("status");
                
                for (TrackingListener l : listeners) {
                    l.onOrderStatus(status);
                }
            } catch (JSONException e) {
                Log.e(TAG, "Error parsing order status: " + e.getMessage());
            }
        });
        
        socket.on("order:eta", args -> {
            try {
                JSONObject data = (JSONObject) args[0];
                int eta = data.optInt("eta", 0);
                String distance = data.optString("distance", "0");
                
                for (TrackingListener l : listeners) {
                    l.onETA(eta, distance);
                }
            } catch (JSONException e) {
                Log.e(TAG, "Error parsing ETA: " + e.getMessage());
            }
        });
        
        socket.on("order:completed", args -> {
            try {
                JSONObject data = (JSONObject) args[0];
                boolean requestRating = data.optBoolean("requestRating", true);
                
                for (TrackingListener l : listeners) {
                    l.onDeliveryCompleted(requestRating);
                }
            } catch (JSONException e) {
                Log.e(TAG, "Error: " + e.getMessage());
            }
        });
        
        socket.on("order:no_drivers", args -> {
            for (TrackingListener l : listeners) {
                l.onNoDriversAvailable();
            }
        });
    }
    
    public void connect() {
        if (!isConnected && socket != null) {
            socket.connect();
        }
    }
    
    public void disconnect() {
        if (socket != null) {
            socket.disconnect();
            isConnected = false;
        }
    }
    
    public void subscribeToOrder(String orderId, String customerId) {
        if (isConnected && socket != null) {
            JSONObject data = new JSONObject();
            try {
                data.put("orderId", orderId);
                data.put("customerId", customerId);
                socket.emit("order:subscribe", data);
            } catch (JSONException e) {
                Log.e(TAG, "Error subscribing to order: " + e.getMessage());
            }
        }
    }
    
    public void unsubscribeFromOrder(String orderId) {
        if (isConnected && socket != null) {
            JSONObject data = new JSONObject();
            try {
                data.put("orderId", orderId);
                socket.emit("order:unsubscribe", data);
            } catch (JSONException e) {
                Log.e(TAG, "Error unsubscribing: " + e.getMessage());
            }
        }
    }
    
    public void requestETA(String orderId) {
        if (isConnected && socket != null) {
            JSONObject data = new JSONObject();
            try {
                data.put("orderId", orderId);
                socket.emit("order:get_eta", data);
            } catch (JSONException e) {
                Log.e(TAG, "Error requesting ETA: " + e.getMessage());
            }
        }
    }
    
    public void rateDriver(String orderId, String driverId, int rating, String comment) {
        if (isConnected && socket != null) {
            JSONObject data = new JSONObject();
            try {
                data.put("orderId", orderId);
                data.put("driverId", driverId);
                data.put("rating", rating);
                data.put("comment", comment);
                socket.emit("driver:rate", data);
            } catch (JSONException e) {
                Log.e(TAG, "Error rating driver: " + e.getMessage());
            }
        }
    }
    
    public boolean isConnected() {
        return isConnected;
    }
}
