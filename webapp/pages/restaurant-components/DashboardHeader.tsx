import { Button } from "@/components/ui/button";

interface DashboardHeaderProps {
  restaurantName?: string;
}

export default function DashboardHeader({ restaurantName }: DashboardHeaderProps) {
  return (
    <header className="bg-secondary text-secondary-foreground border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:flex-row justify-between items-start lg:items-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">{restaurantName || 'Restaurant'} Dashboard</h1>
          <p className="text-secondary-foreground/70">Manage your restaurant, menu, and orders</p>
        </div>
        <div className="flex items-center space-x-4 mt-4 lg:mt-0">
          <div className="text-right">
            <p className="text-sm opacity-75">Status</p>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium">Open</span>
            </div>
          </div>
          <Button className="bg-accent text-accent-foreground hover:bg-accent/90">
            <i className="fas fa-cog mr-2"></i>Settings
          </Button>
        </div>
      </div>
    </header>
  );
}
