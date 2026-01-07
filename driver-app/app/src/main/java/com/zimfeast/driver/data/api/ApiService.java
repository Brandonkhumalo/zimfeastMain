package com.zimfeast.driver.data.api;

import com.zimfeast.driver.data.model.LoginRequest;
import com.zimfeast.driver.data.model.LoginResponse;

import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.POST;

public interface ApiService {
    
    @POST("accounts/login/")
    Call<LoginResponse> login(@Body LoginRequest request);
}
