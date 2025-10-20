import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function Navbar() {
  const [location, setLocation] = useLocation();

  const navigationItems = [
    { path: '/customer', label: 'Customer App', icon: 'fas fa-shopping-bag' },
    { path: '/restaurant', label: 'Restaurant Dashboard', icon: 'fas fa-store' },
    { path: '/driver', label: 'Driver App', icon: 'fas fa-truck' },
  ];

  return (
    <nav className="bg-white border-b border-border sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 
                className="text-2xl font-bold text-primary cursor-pointer"
                onClick={() => setLocation('/')}
                data-testid="logo-zimfeast"
              >
                ZimFeast
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {navigationItems.map((item) => (
              <Button
                key={item.path}
                variant={location === item.path ? "default" : "ghost"}
                onClick={() => setLocation(item.path)}
                className="text-sm font-medium"
                data-testid={`nav-${item.path.slice(1)}`}
              >
                <i className={`${item.icon} mr-2`}></i>
                <span className="hidden sm:inline">{item.label}</span>
              </Button>
            ))}
            <Button
              variant="outline"
              onClick={async () => {
                const token = localStorage.getItem("token");
                if (!token) return window.location.href = "/home";

                try {
                  const res = await fetch("http://127.0.0.1:8000/api/accounts/logout/", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                  });

                  if (!res.ok) throw new Error("Logout failed");

                  // Remove token from localStorage
                  localStorage.removeItem("token");

                  // Redirect to /home
                  window.location.href = "/home";
                } catch (err: any) {
                  console.error(err);
                  alert(err.message || "Logout failed");
                }
              }}>
              <i className="fas fa-sign-out-alt mr-2"></i>
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
