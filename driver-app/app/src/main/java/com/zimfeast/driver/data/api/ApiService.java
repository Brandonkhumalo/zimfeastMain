package com.zimfeast.driver.data.api;

import com.zimfeast.driver.data.model.DriverProfile;
import com.zimfeast.driver.data.model.LoginRequest;
import com.zimfeast.driver.data.model.LoginResponse;
import com.zimfeast.driver.data.model.Order;
import com.zimfeast.driver.data.model.StatusUpdateRequest;
import com.zimfeast.driver.data.model.TokenRefreshRequest;
import com.zimfeast.driver.data.model.TokenRefreshResponse;

import java.util.List;
import java.util.Map;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.GET;
import retrofit2.http.PATCH;
import retrofit2.http.POST;
import retrofit2.http.Path;

public interface ApiService {
    
    @POST("api/accounts/login/")
    Call<LoginResponse> login(@Body LoginRequest request);
    
    @POST("api/accounts/token/refresh/")
    Call<TokenRefreshResponse> refreshToken(@Body TokenRefreshRequest request);
    
    @GET("api/accounts/user/me/")
    Call<DriverProfile> getProfile();
    
    @GET("api/drivers/profile/")
    Call<DriverProfile> getDriverProfile();
    
    @PATCH("api/drivers/profile/")
    Call<DriverProfile> updateDriverProfile(@Body Map<String, Object> updates);
    
    @POST("api/drivers/status/")
    Call<Map<String, Object>> updateDriverStatus(@Body StatusUpdateRequest status);
    
    @GET("api/drivers/orders/")
    Call<List<Order>> getDriverOrders();
    
    @GET("api/orders/order/{id}/")
    Call<Order> getOrder(@Path("id") String orderId);
    
    @POST("api/orders/order/{id}/accept/")
    Call<Map<String, Object>> acceptOrder(@Path("id") String orderId);
    
    @POST("api/orders/order/{id}/reject/")
    Call<Map<String, Object>> rejectOrder(@Path("id") String orderId);
    
    @PATCH("api/orders/order/{id}/status/")
    Call<Map<String, Object>> updateOrderStatus(@Path("id") String orderId, @Body StatusUpdateRequest status);
    
    @POST("api/drivers/location/")
    Call<Map<String, Object>> updateLocation(@Body Map<String, Double> location);
}
