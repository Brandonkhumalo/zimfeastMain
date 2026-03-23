import { Switch, Route, Redirect } from "wouter";
import AdminLayout from "./AdminLayout";
import AdminDashboardPage from "./AdminDashboardPage";
import AdminOrdersPage from "./AdminOrdersPage";
import AdminOrderDetailPage from "./AdminOrderDetailPage";
import AdminFinancePage from "./AdminFinancePage";
import AdminUsersPage from "./AdminUsersPage";
import AdminUserDetailPage from "./AdminUserDetailPage";
import AdminRestaurantsPage from "./AdminRestaurantsPage";
import AdminRestaurantDetailPage from "./AdminRestaurantDetailPage";
import AdminDriversPage from "./AdminDriversPage";
import AdminDriverDetailPage from "./AdminDriverDetailPage";
import AdminPromosPage from "./AdminPromosPage";
import AdminReviewsPage from "./AdminReviewsPage";
import AdminSystemPage from "./AdminSystemPage";
import AdminSettingsPage from "./AdminSettingsPage";
import AdminPendingDriversPage from "./AdminPendingDriversPage";
import AdminBannersPage from "./AdminBannersPage";
import AdminCorporatePage from "./AdminCorporatePage";

/**
 * AdminRouter renders the admin layout shell and switches between
 * admin sub-pages based on the current route. It is mounted at /admin/*
 * from App.tsx, so all paths here are absolute.
 */
export default function AdminRouter() {
  return (
    <AdminLayout>
      <Switch>
        {/* Redirect bare /admin to /admin/dashboard */}
        <Route path="/admin">
          <Redirect to="/admin/dashboard" />
        </Route>

        {/* Dashboard */}
        <Route path="/admin/dashboard" component={AdminDashboardPage} />

        {/* Orders */}
        <Route path="/admin/orders" component={AdminOrdersPage} />
        <Route path="/admin/orders/:id" component={AdminOrderDetailPage} />

        {/* Finance */}
        <Route path="/admin/finance" component={AdminFinancePage} />

        {/* Users */}
        <Route path="/admin/users" component={AdminUsersPage} />
        <Route path="/admin/users/:id" component={AdminUserDetailPage} />

        {/* Restaurants */}
        <Route path="/admin/restaurants" component={AdminRestaurantsPage} />
        <Route path="/admin/restaurants/:id" component={AdminRestaurantDetailPage} />

        {/* Drivers */}
        <Route path="/admin/drivers" component={AdminDriversPage} />
        <Route path="/admin/drivers/pending" component={AdminPendingDriversPage} />
        <Route path="/admin/drivers/:id" component={AdminDriverDetailPage} />

        {/* Promos */}
        <Route path="/admin/promos" component={AdminPromosPage} />

        {/* Reviews */}
        <Route path="/admin/reviews" component={AdminReviewsPage} />

        {/* System */}
        <Route path="/admin/system" component={AdminSystemPage} />

        {/* Banners / Campaigns */}
        <Route path="/admin/banners" component={AdminBannersPage} />

        {/* Corporate Accounts */}
        <Route path="/admin/corporate" component={AdminCorporatePage} />

        {/* Settings */}
        <Route path="/admin/settings" component={AdminSettingsPage} />

        {/* Fallback: redirect unknown admin routes to dashboard */}
        <Route>
          <Redirect to="/admin/dashboard" />
        </Route>
      </Switch>
    </AdminLayout>
  );
}
