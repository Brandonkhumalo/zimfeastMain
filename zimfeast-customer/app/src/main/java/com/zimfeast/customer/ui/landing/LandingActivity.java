package com.zimfeast.customer.ui.landing;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.zimfeast.customer.R;
import com.zimfeast.customer.data.api.ApiClient;
import com.zimfeast.customer.databinding.ActivityLandingBinding;
import com.zimfeast.customer.ui.auth.LoginActivity;
import com.zimfeast.customer.ui.auth.RegisterActivity;
import com.zimfeast.customer.ui.customer.CustomerActivity;

import java.util.Arrays;
import java.util.List;

public class LandingActivity extends AppCompatActivity {

    private ActivityLandingBinding binding;
    private Handler autoScrollHandler;
    private Runnable autoScrollRunnable;
    private int scrollPosition = 0;

    private static final List<Category> CATEGORIES = Arrays.asList(
            new Category("Burger", "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&q=80&w=150"),
            new Category("Pizza", "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=150"),
            new Category("Sushi", "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=150"),
            new Category("Tacos", "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&q=80&w=150"),
            new Category("Salad", "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=150"),
            new Category("Chicken", "https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445?auto=format&fit=crop&q=80&w=150"),
            new Category("Pasta", "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&q=80&w=150"),
            new Category("Dessert", "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&q=80&w=150"),
            new Category("Coffee", "https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&q=80&w=150"),
            new Category("Indian", "https://images.unsplash.com/photo-1585937421612-71100e957b7d?auto=format&fit=crop&q=80&w=150")
    );

    private static final List<CuratedSpot> CURATED_SPOTS = Arrays.asList(
            new CuratedSpot("Neon Umami Sushi", "Sushi, Japanese", 4.8, "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&q=80&w=400"),
            new CuratedSpot("Obsidian Burger Lab", "Burger, American", 4.9, "https://images.unsplash.com/photo-1586190848861-99aa4a171e90?auto=format&fit=crop&q=80&w=400"),
            new CuratedSpot("Lush Greenery Bowl", "Salad, Healthy", 4.6, "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=400"),
            new CuratedSpot("Inferno Pizza Co.", "Pizza, Italian", 4.7, "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&q=80&w=400"),
            new CuratedSpot("Spice Route Delhi", "Indian, Curry", 4.9, "https://images.unsplash.com/photo-1585937421612-71100e957b7d?auto=format&fit=crop&q=80&w=400")
    );

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        binding = ActivityLandingBinding.inflate(getLayoutInflater());
        setContentView(binding.getRoot());

        if (ApiClient.getInstance().getTokenManager().isLoggedIn()) {
            startActivity(new Intent(this, CustomerActivity.class));
            finish();
            return;
        }

        setupClickListeners();
        setupCategories();
        setupCuratedSpots();
        loadFeatureImages();
        startAutoScroll();
    }

    private void setupClickListeners() {
        binding.btnGetStarted.setOnClickListener(v -> {
            startActivity(new Intent(this, RegisterActivity.class));
        });

        binding.btnLogin.setOnClickListener(v -> {
            startActivity(new Intent(this, LoginActivity.class));
        });

        binding.btnBottomGetStarted.setOnClickListener(v -> {
            startActivity(new Intent(this, RegisterActivity.class));
        });

        binding.searchContainer.setOnClickListener(v -> {
            startActivity(new Intent(this, LoginActivity.class));
        });

        binding.btnCuratedPrev.setOnClickListener(v -> {
            RecyclerView rv = binding.rvCuratedSpots;
            LinearLayoutManager lm = (LinearLayoutManager) rv.getLayoutManager();
            if (lm != null) {
                int firstVisible = lm.findFirstVisibleItemPosition();
                if (firstVisible > 0) {
                    rv.smoothScrollToPosition(firstVisible - 1);
                }
            }
        });

        binding.btnCuratedNext.setOnClickListener(v -> {
            RecyclerView rv = binding.rvCuratedSpots;
            LinearLayoutManager lm = (LinearLayoutManager) rv.getLayoutManager();
            if (lm != null) {
                int lastVisible = lm.findLastVisibleItemPosition();
                if (lastVisible < CURATED_SPOTS.size() - 1) {
                    rv.smoothScrollToPosition(lastVisible + 1);
                }
            }
        });
    }

    private void setupCategories() {
        LinearLayout container = binding.categoriesContainer;
        LayoutInflater inflater = LayoutInflater.from(this);

        for (int i = 0; i < 2; i++) {
            for (Category category : CATEGORIES) {
                View itemView = inflater.inflate(R.layout.item_category, container, false);
                ImageView iconView = itemView.findViewById(R.id.iv_category_icon);
                TextView nameView = itemView.findViewById(R.id.tv_category_name);

                nameView.setText(category.name);
                Glide.with(this)
                        .load(category.iconUrl)
                        .centerCrop()
                        .into(iconView);

                itemView.setOnClickListener(v -> {
                    startActivity(new Intent(this, LoginActivity.class));
                });

                container.addView(itemView);
            }
        }
    }

    private void setupCuratedSpots() {
        binding.rvCuratedSpots.setLayoutManager(
                new LinearLayoutManager(this, LinearLayoutManager.HORIZONTAL, false));
        binding.rvCuratedSpots.setAdapter(new CuratedSpotsAdapter(CURATED_SPOTS, () -> {
            startActivity(new Intent(this, LoginActivity.class));
        }));
    }

    private void loadFeatureImages() {
        Glide.with(this)
                .load("https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=150")
                .centerCrop()
                .into(binding.imgHyperFast);

        Glide.with(this)
                .load("https://images.unsplash.com/photo-1563013544-824ae1b704d3?auto=format&fit=crop&q=80&w=150")
                .centerCrop()
                .into(binding.imgSecurePayments);

        Glide.with(this)
                .load("https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&q=80&w=150")
                .centerCrop()
                .into(binding.imgPremiumSelection);
    }

    private void startAutoScroll() {
        autoScrollHandler = new Handler(Looper.getMainLooper());
        autoScrollRunnable = new Runnable() {
            @Override
            public void run() {
                scrollPosition += 3;
                if (binding.categoriesScroll != null) {
                    binding.categoriesScroll.smoothScrollTo(scrollPosition, 0);
                    int maxScroll = binding.categoriesContainer.getWidth() - binding.categoriesScroll.getWidth();
                    if (scrollPosition >= maxScroll / 2) {
                        scrollPosition = 0;
                        binding.categoriesScroll.scrollTo(0, 0);
                    }
                }
                autoScrollHandler.postDelayed(this, 50);
            }
        };
        autoScrollHandler.postDelayed(autoScrollRunnable, 2000);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (autoScrollHandler != null && autoScrollRunnable != null) {
            autoScrollHandler.removeCallbacks(autoScrollRunnable);
        }
    }

    static class Category {
        String name;
        String iconUrl;

        Category(String name, String iconUrl) {
            this.name = name;
            this.iconUrl = iconUrl;
        }
    }

    static class CuratedSpot {
        String name;
        String cuisine;
        double rating;
        String imageUrl;

        CuratedSpot(String name, String cuisine, double rating, String imageUrl) {
            this.name = name;
            this.cuisine = cuisine;
            this.rating = rating;
            this.imageUrl = imageUrl;
        }
    }
}
