import { useState, type ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  ShoppingBag,
  DollarSign,
  Users,
  Store,
  Truck,
  Tag,
  Star,
  Activity,
  Settings,
  LogOut,
  Search,
  Menu,
  ChevronLeft,
  ChevronRight,
  UtensilsCrossed,
  UserCheck,
  Image,
  Building2,
  type LucideIcon,
} from "lucide-react";

/** Navigation item definition */
interface NavItem {
  label: string;
  icon: LucideIcon;
  path: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard",   icon: LayoutDashboard, path: "/admin/dashboard" },
  { label: "Orders",      icon: ShoppingBag,     path: "/admin/orders" },
  { label: "Finance",     icon: DollarSign,       path: "/admin/finance" },
  { label: "Users",       icon: Users,            path: "/admin/users" },
  { label: "Restaurants", icon: Store,            path: "/admin/restaurants" },
  { label: "Drivers",     icon: Truck,            path: "/admin/drivers" },
  { label: "Approvals",   icon: UserCheck,        path: "/admin/drivers/pending" },
  { label: "Banners",     icon: Image,            path: "/admin/banners" },
  { label: "Corporate",   icon: Building2,        path: "/admin/corporate" },
  { label: "Promos",      icon: Tag,              path: "/admin/promos" },
  { label: "Reviews",     icon: Star,             path: "/admin/reviews" },
  { label: "System",      icon: Activity,         path: "/admin/system" },
  { label: "Settings",    icon: Settings,         path: "/admin/settings" },
];

interface AdminLayoutProps {
  children: ReactNode;
  /** Page title displayed in the header bar */
  pageTitle?: string;
}

/** Check if a path matches the current location (handles sub-routes like /admin/orders/:id) */
function isActive(currentPath: string, navPath: string): boolean {
  if (navPath === "/admin/dashboard") {
    return currentPath === "/admin/dashboard" || currentPath === "/admin";
  }
  return currentPath === navPath || currentPath.startsWith(navPath + "/");
}

export default function AdminLayout({ children, pageTitle }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  function handleLogout() {
    localStorage.removeItem("token");
    window.location.href = "/login";
  }

  /** Derive the page title from the current nav item if not explicitly passed */
  const currentNav = navItems.find((item) => isActive(location, item.path));
  const displayTitle = pageTitle || currentNav?.label || "Admin";

  /** Shared sidebar content used by both desktop sidebar and mobile sheet */
  function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
    return (
      <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(location, item.path);
          return (
            <Link key={item.path} href={item.path} onClick={onNavigate}>
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-orange-500/10 text-orange-500"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                )}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0",
                    active ? "text-orange-500" : "text-zinc-500"
                  )}
                />
                {/* Label hidden when sidebar is collapsed (desktop only) */}
                <span
                  className={cn(
                    "truncate transition-opacity duration-200",
                    collapsed ? "lg:hidden" : ""
                  )}
                >
                  {item.label}
                </span>
                {/* Active indicator bar */}
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                )}
              </div>
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      {/* ========== Desktop Sidebar ========== */}
      <aside
        className={cn(
          "hidden lg:flex flex-col bg-zinc-900 border-r border-zinc-800 transition-all duration-300 shrink-0",
          collapsed ? "w-[64px]" : "w-[280px]"
        )}
      >
        {/* Logo area */}
        <div
          className={cn(
            "flex items-center border-b border-zinc-800 h-16 shrink-0",
            collapsed ? "justify-center px-2" : "px-5"
          )}
        >
          <Link href="/admin/dashboard">
            <div className="flex items-center gap-2.5 cursor-pointer">
              <div className="bg-orange-500 rounded-lg p-1.5 shrink-0">
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </div>
              {!collapsed && (
                <span className="text-lg font-bold text-white tracking-tight">
                  ZimFeast
                </span>
              )}
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <SidebarNav />

        {/* Collapse toggle */}
        <div className="border-t border-zinc-800 p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex items-center justify-center w-full rounded-lg py-2 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          >
            {collapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ========== Medium screen collapsed sidebar ========== */}
      <aside className="hidden md:flex lg:hidden flex-col bg-zinc-900 border-r border-zinc-800 w-[64px] shrink-0">
        {/* Logo icon only */}
        <div className="flex items-center justify-center h-16 border-b border-zinc-800">
          <Link href="/admin/dashboard">
            <div className="bg-orange-500 rounded-lg p-1.5 cursor-pointer">
              <UtensilsCrossed className="h-5 w-5 text-white" />
            </div>
          </Link>
        </div>

        {/* Icon-only nav */}
        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(location, item.path);
            return (
              <Link key={item.path} href={item.path}>
                <div
                  className={cn(
                    "flex items-center justify-center rounded-lg p-2.5 transition-colors group relative",
                    active
                      ? "bg-orange-500/10 text-orange-500"
                      : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
                  )}
                  title={item.label}
                >
                  <item.icon className="h-5 w-5" />
                  {/* Tooltip on hover */}
                  <span className="absolute left-full ml-2 px-2 py-1 bg-zinc-800 text-zinc-100 text-xs rounded-md opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* ========== Mobile Sidebar (Sheet) ========== */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] bg-zinc-900 border-zinc-800 p-0">
          <SheetHeader className="border-b border-zinc-800 h-16 flex flex-row items-center px-5">
            <div className="flex items-center gap-2.5">
              <div className="bg-orange-500 rounded-lg p-1.5">
                <UtensilsCrossed className="h-5 w-5 text-white" />
              </div>
              <SheetTitle className="text-lg font-bold text-white tracking-tight">
                ZimFeast
              </SheetTitle>
            </div>
          </SheetHeader>
          <SidebarNav onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* ========== Main Content Area ========== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top header bar */}
        <header className="flex items-center justify-between h-16 border-b bg-white px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>

            <h2 className="text-lg font-semibold tracking-tight truncate">
              {displayTitle}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            {/* Search bar — hidden on small screens */}
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 lg:w-64 pl-9 h-9 bg-zinc-50 border-zinc-200"
              />
            </div>

            {/* Admin user info */}
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <div className="h-8 w-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-700 font-semibold text-xs">
                {user?.first_name?.[0]?.toUpperCase() ?? "A"}
                {user?.last_name?.[0]?.toUpperCase() ?? ""}
              </div>
              <span className="text-muted-foreground hidden lg:inline">
                {user?.first_name} {user?.last_name}
              </span>
            </div>

            {/* Logout */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-red-600"
            >
              <LogOut className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </header>

        {/* Scrollable content area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
