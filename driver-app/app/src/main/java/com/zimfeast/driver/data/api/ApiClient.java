package com.zimfeast.driver.data.api;

import com.zimfeast.driver.ZimFeastDriverApp;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiClient {
    
    private static final String BASE_URL = com.zimfeast.driver.BuildConfig.BASE_URL;
    private static Retrofit retrofit = null;
    
    public static String getBaseUrl() {
        return BASE_URL;
    }
    
    public static Retrofit getClient() {
        if (retrofit == null) {
            HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
            logging.setLevel(HttpLoggingInterceptor.Level.BODY);
            
            OkHttpClient client = new OkHttpClient.Builder()
                .addInterceptor(logging)
                .addInterceptor(chain -> {
                    Request original = chain.request();
                    Request.Builder requestBuilder = original.newBuilder();
                    
                    String token = ZimFeastDriverApp.getInstance().getAuthToken();
                    if (token != null) {
                        requestBuilder.header("Authorization", "Bearer " + token);
                    }
                    
                    return chain.proceed(requestBuilder.build());
                })
                .build();
            
            retrofit = new Retrofit.Builder()
                .baseUrl(BASE_URL)
                .client(client)
                .addConverterFactory(GsonConverterFactory.create())
                .build();
        }
        return retrofit;
    }
}
