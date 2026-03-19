package com.zimfeast.customer;

import android.app.Application;

import com.zimfeast.customer.data.api.ApiClient;

public class ZimFeastApplication extends Application {

    private static ZimFeastApplication instance;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        ApiClient.init(this);
    }

    public static ZimFeastApplication getInstance() {
        return instance;
    }
}
