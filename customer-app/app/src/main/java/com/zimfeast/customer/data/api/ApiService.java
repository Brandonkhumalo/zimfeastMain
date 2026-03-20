package com.zimfeast.customer.data.api;

import com.zimfeast.customer.data.model.Address;
import com.zimfeast.customer.data.model.AuthResponse;
import com.zimfeast.customer.data.model.CreateOrderResponse;
import com.zimfeast.customer.data.model.MenuItem;
import com.zimfeast.customer.data.model.Order;
import com.zimfeast.customer.data.model.PaymentRequest;
import com.zimfeast.customer.data.model.PaymentResponse;
import com.zimfeast.customer.data.model.PromoValidation;
import com.zimfeast.customer.data.model.ReferralCodeResponse;
import com.zimfeast.customer.data.model.ReferralCreditsResponse;
import com.zimfeast.customer.data.model.Restaurant;
import com.zimfeast.customer.data.model.RestaurantResponse;
import com.zimfeast.customer.data.model.User;
import com.zimfeast.customer.data.model.VoucherBalance;

import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.PATCH;
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

    @GET("api/restaurants/nearby/")
    Call<RestaurantResponse> getNearbyRestaurants(
            @Query("lat") Double lat,
            @Query("lng") Double lng,
            @Query("page_size") Integer pageSize
    );

    @GET("api/restaurants/get/all/")
    Call<List<Restaurant>> getRestaurants();

    @GET("api/restaurants/")
    Call<List<Restaurant>> getRestaurantsByCuisine(@Query("cuisine") String cuisine);

    @GET("api/restaurants/{id}/")
    Call<Restaurant> getRestaurant(@Path("id") String id);

    @GET("api/restaurants/{id}/menu/")
    Call<List<MenuItem>> getRestaurantMenu(@Path("id") String restaurantId);

    @GET("api/restaurants/{id}/menu-data/")
    Call<List<MenuItem>> getRestaurantMenuData(@Path("id") String restaurantId);

    @POST("api/orders/create/")
    Call<CreateOrderResponse> createOrder(@Body Map<String, Object> orderData);

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

    @GET("api/restaurants/{id}/payment-info/")
    Call<Map<String, Object>> getRestaurantPaymentInfo(@Path("id") String restaurantId);

    // Rating endpoints
    @POST("api/restaurants/{id}/review/")
    Call<Map<String, Object>> submitRestaurantReview(@Path("id") String restaurantId, @Body Map<String, Object> review);

    @POST("api/drivers/rate/driver/")
    Call<Map<String, Object>> submitDriverRating(@Body Map<String, Object> rating);

    // ── Address Book endpoints ─────────────────────────────────────────
    @GET("api/accounts/addresses/")
    Call<List<Address>> getAddresses();

    @POST("api/accounts/addresses/")
    Call<Address> createAddress(@Body Map<String, Object> addressData);

    @PATCH("api/accounts/addresses/{id}/")
    Call<Address> updateAddress(@Path("id") String id, @Body Map<String, Object> addressData);

    @DELETE("api/accounts/addresses/{id}/")
    Call<Void> deleteAddress(@Path("id") String id);

    // ── Promo & Referral endpoints ───────────────────────────────────────
    @POST("api/payments/promo/validate/")
    Call<PromoValidation> validatePromo(@Body Map<String, Object> promoData);

    @GET("api/payments/referral/code/")
    Call<ReferralCodeResponse> getReferralCode();

    @GET("api/payments/referral/credits/")
    Call<ReferralCreditsResponse> getReferralCredits();
}
