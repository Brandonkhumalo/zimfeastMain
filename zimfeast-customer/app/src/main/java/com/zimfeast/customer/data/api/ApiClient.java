package com.zimfeast.customer.data.api;

import android.content.Context;

import com.zimfeast.customer.util.TokenManager;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiClient {
    private static final String BASE_URL = "http://192.168.1.9:8000/";
    private static ApiClient instance;
    private final ApiService apiService;
    private final TokenManager tokenManager;

    private ApiClient(Context context) {
        tokenManager = new TokenManager(context);

        HttpLoggingInterceptor loggingInterceptor = new HttpLoggingInterceptor();
        loggingInterceptor.setLevel(HttpLoggingInterceptor.Level.BODY);

        OkHttpClient client = new OkHttpClient.Builder()
                .addInterceptor(chain -> {
                    Request original = chain.request();
                    Request.Builder builder = original.newBuilder();

                    String token = tokenManager.getToken();
                    if (token != null && !token.isEmpty()) {
                        builder.header("Authorization", "Bearer " + token);
                    }

                    builder.header("Content-Type", "application/json");
                    return chain.proceed(builder.build());
                })
                .addInterceptor(loggingInterceptor)
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .writeTimeout(30, TimeUnit.SECONDS)
                .build();

        Retrofit retrofit = new Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build();

        apiService = retrofit.create(ApiService.class);
    }

    public static void init(Context context) {
        if (instance == null) {
            instance = new ApiClient(context.getApplicationContext());
        }
    }

    public static ApiClient getInstance() {
        if (instance == null) {
            throw new IllegalStateException("ApiClient not initialized. Call init() first.");
        }
        return instance;
    }

    public ApiService getApiService() {
        return apiService;
    }

    public TokenManager getTokenManager() {
        return tokenManager;
    }
}
