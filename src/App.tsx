import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/Landing";
import Home from "@/pages/Home";
import CustomerApp from "@/pages/CustomerApp";
import RestaurantDashboard from "@/pages/RestaurantDashboard";
import DriverApp from "@/pages/DriverApp";
import BusinessHub from "@/pages/BusinessHub";
import AdminDashboard from "@/pages/AdminDashboard";
import Checkout from "@/pages/Checkout";
import Login from '@/pages/Login';
import RegisterPage from "./pages/RegisterPage";

interface PrivateRouteProps {
  component: React.FC;
  allowedRoles?: Array<"customer" | "driver" | "restaurant" | "admin">;
}

function PrivateRoute({ component: Component, allowedRoles }: PrivateRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Redirect to="/login" />;

  // Role check
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <h1 className="text-3xl font-bold text-red-600">Unauthorized</h1>
        <p className="text-muted-foreground mt-2">
          You do not have access to this portal.
        </p>
      </div>
    );
  }

  return <Component />;
}

function AppRouter() {
  return (
    <Switch>
      {/* Public routes */}
      <Route path="/" component={Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/business-hub" component={BusinessHub} />

      {/* Private routes with role guards */}
      <Route path="/home" component={() => <PrivateRoute component={Home} />} />
      <Route path="/customer" component={() => <PrivateRoute component={CustomerApp} allowedRoles={["customer", "admin"]} />} />
      <Route path="/restaurant" component={() => <PrivateRoute component={RestaurantDashboard} allowedRoles={["restaurant", "admin"]} />} />
      <Route path="/driver" component={() => <PrivateRoute component={DriverApp} allowedRoles={["driver", "admin"]} />} />
      <Route path="/admin" component={() => <PrivateRoute component={AdminDashboard} allowedRoles={["admin"]} />} />
      <Route path="/checkout" component={Checkout} />

      {/* Fallback 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppRouter />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
