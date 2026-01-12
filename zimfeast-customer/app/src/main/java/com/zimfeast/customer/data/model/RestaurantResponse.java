package com.zimfeast.customer.data.model;

import java.util.List;

public class RestaurantResponse {
    private int count;
    private int page;
    private int page_size;
    private List<Restaurant> results;

    public int getCount() { return count; }
    public void setCount(int count) { this.count = count; }

    public int getPage() { return page; }
    public void setPage(int page) { this.page = page; }

    public int getPage_size() { return page_size; }
    public void setPage_size(int page_size) { this.page_size = page_size; }

    public List<Restaurant> getResults() { return results; }
    public void setResults(List<Restaurant> results) { this.results = results; }
}
