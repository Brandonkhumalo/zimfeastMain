import { PortalCard } from "./PortalCard";
import { User } from "./types";

interface PortalSelectionProps {
  user?: User;
  onNavigate: (portal: string) => void;
}

export function PortalSelection({ user, onNavigate }: PortalSelectionProps) {
  return (
    <section className="py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">Choose Your Portal</h2>
          <p className="text-muted-foreground text-lg">
            Access different features based on your role
          </p>
        </div>

        <div className={`grid grid-cols-1 gap-8 ${user?.role === 'admin' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
          {user?.role === 'admin' && (
            <PortalCard
              title="Admin Dashboard"
              description="Review business applications and manage the platform"
              iconClass="fas fa-shield-alt text-purple-600"
              iconBgClass="bg-purple-100"
              buttonText="Admin Panel"
              buttonVariant="outline"
              buttonClass="border-purple-600 text-purple-600 hover:bg-purple-50"
              onClick={() => onNavigate('admin')}
            />
          )}

          <PortalCard
            title="Customer App"
            description="Browse restaurants, place orders, and track deliveries"
            iconClass="fas fa-shopping-bag text-primary"
            iconBgClass="bg-primary/10"
            buttonText="Order Food"
            onClick={() => onNavigate('customer')}
          />

          <PortalCard
            title="Restaurant Dashboard"
            description="Manage your restaurant, menu, and orders"
            iconClass="fas fa-store text-secondary"
            iconBgClass="bg-secondary/10"
            buttonText="Manage Restaurant"
            buttonVariant="secondary"
            onClick={() => onNavigate('restaurant')}
          />

          <PortalCard
            title="Driver App"
            description="Accept deliveries and manage your earnings"
            iconClass="fas fa-truck text-accent"
            iconBgClass="bg-accent/10"
            buttonText="Start Driving"
            buttonClass="bg-accent hover:bg-accent/90"
            onClick={() => onNavigate('driver')}
          />
        </div>
      </div>
    </section>
  );
}
