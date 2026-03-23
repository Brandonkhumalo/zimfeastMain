package com.zimfeast.driver.ui;

import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.View;
import android.widget.TextView;

import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.MapView;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.model.BitmapDescriptorFactory;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.LatLngBounds;
import com.google.android.gms.maps.model.Marker;
import com.google.android.gms.maps.model.MarkerOptions;
import com.google.android.gms.maps.model.Polyline;
import com.google.android.gms.maps.model.PolylineOptions;
import com.google.maps.android.PolyUtil;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.IOException;
import java.util.List;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;

/**
 * NavigationHelper manages an embedded Google Map for in-app turn-by-turn navigation.
 *
 * Responsibilities:
 *  - Initialize a MapView and obtain the GoogleMap instance.
 *  - Fetch driving routes from the Google Directions API.
 *  - Decode polyline geometry and draw it on the map.
 *  - Place coloured markers for the driver (blue), pickup (green), and dropoff (red).
 *  - Display ETA and distance in overlay TextViews parsed from the API response.
 *  - Allow switching destination (restaurant vs customer) during delivery.
 *  - Forward MapView lifecycle events so the map releases resources correctly.
 *
 * Usage:
 *   1. Construct with a Context, MapView, and the Activity's savedInstanceState Bundle.
 *   2. Call setOverlayViews() to bind the ETA / distance TextViews.
 *   3. Call setDestination() to pick the target (restaurant or customer).
 *   4. Call updateDriverLocation() whenever the driver's GPS position changes.
 */
public class NavigationHelper implements OnMapReadyCallback {

    private static final String TAG = "NavigationHelper";

    // Google-blue colour used for the route polyline
    private static final int ROUTE_COLOR = Color.parseColor("#4285F4");
    private static final float ROUTE_WIDTH = 12f;

    // Padding (in pixels) when fitting the camera to the route bounds
    private static final int BOUNDS_PADDING_PX = 120;

    // ── Core references ──────────────────────────────────────────────────
    private final Context context;
    private final MapView mapView;
    private final OkHttpClient httpClient;
    private final Handler mainHandler;

    // Google Maps API key read from AndroidManifest <meta-data>
    private final String apiKey;

    // ── Map objects ──────────────────────────────────────────────────────
    private GoogleMap googleMap;
    private Marker driverMarker;
    private Marker pickupMarker;
    private Marker dropoffMarker;
    private Polyline routePolyline;

    // ── Current positions ────────────────────────────────────────────────
    private double driverLat;
    private double driverLng;
    private double destLat;
    private double destLng;
    private String destLabel;

    // ── Overlay views (optional – set via setOverlayViews) ───────────────
    private TextView tvEta;
    private TextView tvDistance;
    private View overlayEta;

    // ──────────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Creates a NavigationHelper and initialises the MapView.
     *
     * @param context            Activity or Application context.
     * @param mapView            The MapView defined in the layout XML.
     * @param savedInstanceState The Activity's savedInstanceState Bundle (may be null).
     */
    public NavigationHelper(Context context, MapView mapView, Bundle savedInstanceState) {
        this.context = context;
        this.mapView = mapView;
        this.httpClient = new OkHttpClient();
        this.mainHandler = new Handler(Looper.getMainLooper());

        // Read the Google Maps API key from AndroidManifest metadata.
        // This avoids hard-coding the key anywhere in source code.
        this.apiKey = readApiKeyFromManifest();

        // Initialise the MapView lifecycle and request the GoogleMap asynchronously
        mapView.onCreate(savedInstanceState);
        mapView.getMapAsync(this);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Public API
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Bind overlay views that display ETA and distance on top of the map.
     *
     * @param tvEta      TextView for estimated time of arrival (e.g. "12 min").
     * @param tvDistance  TextView for distance (e.g. "4.3 km").
     * @param overlayEta Parent view containing both TextViews – shown/hidden as needed.
     */
    public void setOverlayViews(TextView tvEta, TextView tvDistance, View overlayEta) {
        this.tvEta = tvEta;
        this.tvDistance = tvDistance;
        this.overlayEta = overlayEta;
    }

    /**
     * Set or switch the navigation destination.
     * Call this when the delivery status changes (e.g. from heading to restaurant
     * to heading to customer).
     *
     * @param lat   Destination latitude.
     * @param lng   Destination longitude.
     * @param label Human-readable label shown on the marker (e.g. restaurant name).
     */
    public void setDestination(double lat, double lng, String label) {
        this.destLat = lat;
        this.destLng = lng;
        this.destLabel = label;

        // If the map is ready and we already have a driver position, fetch the route
        if (googleMap != null && driverLat != 0 && driverLng != 0) {
            fetchRoute();
        }
    }

    /**
     * Update the driver's current GPS position on the map.
     * Also re-fetches the route so ETA and distance stay current.
     *
     * @param lat Driver latitude.
     * @param lng Driver longitude.
     */
    public void updateDriverLocation(double lat, double lng) {
        this.driverLat = lat;
        this.driverLng = lng;

        if (googleMap == null) return;

        // Move or create the blue driver marker
        LatLng driverPos = new LatLng(lat, lng);
        if (driverMarker == null) {
            driverMarker = googleMap.addMarker(
                    new MarkerOptions()
                            .position(driverPos)
                            .title("You")
                            .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_AZURE))
            );
        } else {
            driverMarker.setPosition(driverPos);
        }

        // Re-fetch route if we have a destination set
        if (destLat != 0 && destLng != 0) {
            fetchRoute();
        }
    }

    /**
     * Animate the camera to fit both the driver and destination within the viewport.
     * Uses BOUNDS_PADDING_PX pixels of padding around the edges.
     */
    public void recenterMap() {
        if (googleMap == null) return;

        // Build a bounding box that includes the driver and destination
        LatLngBounds.Builder boundsBuilder = new LatLngBounds.Builder();

        if (driverLat != 0 && driverLng != 0) {
            boundsBuilder.include(new LatLng(driverLat, driverLng));
        }
        if (destLat != 0 && destLng != 0) {
            boundsBuilder.include(new LatLng(destLat, destLng));
        }

        try {
            LatLngBounds bounds = boundsBuilder.build();
            googleMap.animateCamera(CameraUpdateFactory.newLatLngBounds(bounds, BOUNDS_PADDING_PX));
        } catch (IllegalStateException e) {
            // Not enough points to build bounds – ignore
            Log.w(TAG, "Cannot recenter: insufficient points for bounds", e);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    //  MapView lifecycle forwarding
    //  The host Activity MUST call these from its own lifecycle methods.
    // ──────────────────────────────────────────────────────────────────────

    public void onResume() {
        mapView.onResume();
    }

    public void onPause() {
        mapView.onPause();
    }

    public void onDestroy() {
        mapView.onDestroy();
    }

    public void onLowMemory() {
        mapView.onLowMemory();
    }

    public void onSaveInstanceState(Bundle outState) {
        mapView.onSaveInstanceState(outState);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  OnMapReadyCallback
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Called when the GoogleMap instance is ready to use.
     * Configures default map settings and triggers the first route fetch
     * if a destination has already been set.
     */
    @Override
    public void onMapReady(GoogleMap map) {
        this.googleMap = map;

        // Basic map UI configuration
        map.getUiSettings().setZoomControlsEnabled(false);
        map.getUiSettings().setMyLocationButtonEnabled(false);
        map.getUiSettings().setMapToolbarEnabled(false);

        // If both driver position and destination were set before the map was ready, fetch now
        if (driverLat != 0 && driverLng != 0 && destLat != 0 && destLng != 0) {
            fetchRoute();
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Directions API
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Fetches a driving route from the Google Directions API using the current
     * driver position as the origin and destLat/destLng as the destination.
     *
     * The network call runs on OkHttp's background thread pool. The JSON response
     * is parsed manually with org.json, and UI updates are posted back to the
     * main thread via {@link #mainHandler}.
     */
    private void fetchRoute() {
        if (apiKey == null || apiKey.isEmpty()) {
            Log.e(TAG, "Google Maps API key is missing – cannot fetch route");
            return;
        }

        // Build the Directions API URL
        String url = "https://maps.googleapis.com/maps/api/directions/json"
                + "?origin=" + driverLat + "," + driverLng
                + "&destination=" + destLat + "," + destLng
                + "&mode=driving"
                + "&key=" + apiKey;

        Request request = new Request.Builder().url(url).build();

        // Asynchronous HTTP call – runs on OkHttp's internal thread pool
        httpClient.newCall(request).enqueue(new Callback() {
            @Override
            public void onFailure(Call call, IOException e) {
                Log.e(TAG, "Directions API request failed", e);
            }

            @Override
            public void onResponse(Call call, Response response) throws IOException {
                if (!response.isSuccessful() || response.body() == null) {
                    Log.e(TAG, "Directions API returned HTTP " + response.code());
                    return;
                }

                try {
                    String json = response.body().string();
                    JSONObject root = new JSONObject(json);
                    String status = root.optString("status", "");

                    if (!"OK".equals(status)) {
                        Log.w(TAG, "Directions API status: " + status);
                        return;
                    }

                    // The API returns an array of routes; we use the first one
                    JSONArray routes = root.getJSONArray("routes");
                    if (routes.length() == 0) return;

                    JSONObject route = routes.getJSONObject(0);

                    // ── Decode the overview polyline ──────────────────────
                    String encodedPolyline = route
                            .getJSONObject("overview_polyline")
                            .getString("points");

                    // PolyUtil.decode() converts the encoded string into a list of LatLng points
                    List<LatLng> decodedPath = PolyUtil.decode(encodedPolyline);

                    // ── Extract ETA and distance from the first leg ──────
                    JSONObject leg = route.getJSONArray("legs").getJSONObject(0);
                    String duration = leg.getJSONObject("duration").getString("text");
                    String distance = leg.getJSONObject("distance").getString("text");

                    // All UI work must happen on the main thread
                    mainHandler.post(() -> {
                        drawRouteOnMap(decodedPath);
                        updateOverlay(duration, distance);
                        placeDestinationMarker();
                        recenterMap();
                    });

                } catch (Exception e) {
                    Log.e(TAG, "Error parsing Directions API response", e);
                }
            }
        });
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Map drawing helpers
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Draws (or redraws) the route polyline on the map.
     * Removes any previously drawn polyline first to avoid stacking lines.
     *
     * @param path List of LatLng points decoded from the Directions API polyline.
     */
    private void drawRouteOnMap(List<LatLng> path) {
        if (googleMap == null || path == null || path.isEmpty()) return;

        // Remove old polyline if present
        if (routePolyline != null) {
            routePolyline.remove();
        }

        // Draw a new polyline in Google-blue
        routePolyline = googleMap.addPolyline(
                new PolylineOptions()
                        .addAll(path)
                        .color(ROUTE_COLOR)
                        .width(ROUTE_WIDTH)
        );
    }

    /**
     * Places a marker at the current destination.
     * Uses green for pickup locations and red for dropoff locations.
     * A simple heuristic: if the label contains "pickup" (case-insensitive) it is
     * treated as a pickup marker; otherwise it defaults to a dropoff (red) marker.
     * You can also explicitly manage this by removing/adding markers when switching.
     */
    private void placeDestinationMarker() {
        if (googleMap == null) return;

        LatLng destPos = new LatLng(destLat, destLng);

        // Determine marker colour based on destination label
        boolean isPickup = destLabel != null && destLabel.toLowerCase().contains("pickup");

        if (isPickup) {
            // Remove any existing pickup marker and (re)create it
            if (pickupMarker != null) pickupMarker.remove();
            pickupMarker = googleMap.addMarker(
                    new MarkerOptions()
                            .position(destPos)
                            .title(destLabel != null ? destLabel : "Pickup")
                            .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_GREEN))
            );
        } else {
            // Remove any existing dropoff marker and (re)create it
            if (dropoffMarker != null) dropoffMarker.remove();
            dropoffMarker = googleMap.addMarker(
                    new MarkerOptions()
                            .position(destPos)
                            .title(destLabel != null ? destLabel : "Dropoff")
                            .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_RED))
            );
        }
    }

    /**
     * Updates the ETA and distance overlay TextViews with values returned by
     * the Directions API. Shows the overlay container if it was previously hidden.
     *
     * @param eta      Human-readable ETA string (e.g. "12 mins").
     * @param distance Human-readable distance string (e.g. "4.3 km").
     */
    private void updateOverlay(String eta, String distance) {
        if (tvEta != null) {
            tvEta.setText(eta);
        }
        if (tvDistance != null) {
            tvDistance.setText(distance);
        }
        if (overlayEta != null) {
            overlayEta.setVisibility(View.VISIBLE);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Internal utilities
    // ──────────────────────────────────────────────────────────────────────

    /**
     * Reads the Google Maps API key from the AndroidManifest <meta-data> element
     * with the name "com.google.android.geo.API_KEY".
     *
     * @return The API key string, or null if it could not be read.
     */
    private String readApiKeyFromManifest() {
        try {
            ApplicationInfo ai = context.getPackageManager()
                    .getApplicationInfo(context.getPackageName(), PackageManager.GET_META_DATA);
            if (ai.metaData != null) {
                return ai.metaData.getString("com.google.android.geo.API_KEY");
            }
        } catch (PackageManager.NameNotFoundException e) {
            Log.e(TAG, "Failed to read API key from AndroidManifest", e);
        }
        return null;
    }
}
