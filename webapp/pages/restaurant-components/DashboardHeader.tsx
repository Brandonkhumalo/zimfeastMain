import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface DashboardHeaderProps {
  restaurantName?: string;
  isOpen?: boolean;
  onToggleOpen?: (newIsOpen: boolean) => void;
}

export default function DashboardHeader({ restaurantName, isOpen, onToggleOpen }: DashboardHeaderProps) {
  const { toast } = useToast();
  const [toggling, setToggling] = useState(false);

  // Default to open if not provided
  const open = isOpen !== undefined ? isOpen : true;

  const handleToggle = async () => {
    setToggling(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/restaurants/toggle-open/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ is_open: !open }),
      });

      if (!res.ok) throw new Error("Failed to toggle status");

      const data = await res.json();
      const newStatus = data.is_open;

      if (onToggleOpen) {
        onToggleOpen(newStatus);
      }

      toast({
        title: newStatus ? "Restaurant Opened" : "Restaurant Closed",
        description: newStatus
          ? "Your restaurant is now accepting orders."
          : "Your restaurant is now marked as closed.",
      });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to toggle restaurant status",
        variant: "destructive",
      });
    } finally {
      setToggling(false);
    }
  };

  return (
    <header className="bg-secondary text-secondary-foreground border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row justify-between items-start lg:items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">{restaurantName || 'Restaurant'} Dashboard</h1>
          <p className="text-secondary-foreground/70">Manage your restaurant, menu, and orders</p>
        </div>
        <div className="flex items-center space-x-4 mt-4 lg:mt-0">
          {/* Open/Closed toggle */}
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm opacity-75">Status</p>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full transition-colors ${open ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="text-sm font-medium">{open ? 'Open' : 'Closed'}</span>
              </div>
            </div>
            <button
              onClick={handleToggle}
              disabled={toggling}
              className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                open ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-600'
              }`}
              role="switch"
              aria-checked={open}
              aria-label="Toggle restaurant open/closed"
              data-testid="switch-toggle-open"
            >
              <span
                className={`pointer-events-none inline-block h-6 w-6 rounded-full bg-white shadow-lg ring-0 transition-transform duration-200 ease-in-out ${
                  open ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            <i className="fas fa-cog mr-2"></i>Settings
          </Button>
        </div>
      </div>
    </header>
  );
}
