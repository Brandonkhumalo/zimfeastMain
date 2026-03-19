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
    <nav className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 
                className="text-2xl font-black tracking-tighter cursor-pointer bg-gradient-to-r from-orange-500 to-orange-600 bg-clip-text text-transparent"
                onClick={() => setLocation('/')}
                data-testid="logo-zimfeast"
              >
                ZIMFEAST
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {navigationItems.map((item) => (
              <Button
                key={item.path}
                variant={location === item.path ? "default" : "ghost"}
                onClick={() => setLocation(item.path)}
                className={`text-sm font-bold rounded-xl transition-all ${
                  location === item.path 
                    ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30" 
                    : "hover:bg-orange-50 dark:hover:bg-orange-500/10 hover:text-orange-600"
                }`}
                data-testid={`nav-${item.path.slice(1)}`}
              >
                <i className={`${item.icon} mr-2`}></i>
                <span className="hidden sm:inline">{item.label}</span>
              </Button>
            ))}
            <Button
              variant="outline"
              className="rounded-xl border-zinc-200 dark:border-white/10 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 hover:border-red-200"
              onClick={async () => {
                const token = localStorage.getItem("token");
                if (!token) return window.location.href = "/home";

                try {
                  const res = await fetch("/api/accounts/logout/", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Authorization: `Bearer ${token}`,
                    },
                  });

                  if (!res.ok) throw new Error("Logout failed");

                  localStorage.removeItem("token");
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
