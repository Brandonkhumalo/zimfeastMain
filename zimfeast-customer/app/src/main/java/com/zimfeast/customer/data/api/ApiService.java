package com.zimfeast.customer.data.api;

import com.zimfeast.customer.data.model.AuthResponse;
import com.zimfeast.customer.data.model.MenuItem;
import com.zimfeast.customer.data.model.Order;
import com.zimfeast.customer.data.model.PaymentRequest;
import com.zimfeast.customer.data.model.PaymentResponse;
import com.zimfeast.customer.data.model.Restaurant;
import com.zimfeast.customer.data.model.User;
import com.zimfeast.customer.data.model.VoucherBalance;

import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.POST;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface ApiService {

    @POST("api/accounts/login/")
    Call<AuthResponse> login(@Body Map<String, String> credentials);

    @POST("api/accounts/register/")
    Call<AuthResponse> register(@Body Map<String, String> userData);

    @GET("api/accounts/profile/")
    Call<User> getProfile();

    @GET("api/restaurants/")
    Call<List<Restaurant>> getRestaurants();

    @GET("api/restaurants/")
    Call<List<Restaurant>> getRestaurantsByCuisine(@Query("cuisine") String cuisine);

    @GET("api/restaurants/{id}/")
    Call<Restaurant> getRestaurant(@Path("id") String id);

    @GET("api/restaurants/{id}/menu/")
    Call<List<MenuItem>> getRestaurantMenu(@Path("id") String restaurantId);

    @POST("api/orders/")
    Call<Order> createOrder(@Body Map<String, Object> orderData);

    @GET("api/orders/order/{id}/")
    Call<Order> getOrder(@Path("id") String id);

    @GET("api/orders/my-orders/")
    Call<List<Order>> getMyOrders();

    @POST("api/payments/create/payment/")
    Call<PaymentResponse> createPayment(@Body PaymentRequest request);

    @GET("api/payments/feast/voucher/balance/")
    Call<VoucherBalance> getVoucherBalance();

    @GET("api/orders/order/{id}/status/")
    Call<Order> getOrderStatus(@Path("id") String id);
}
