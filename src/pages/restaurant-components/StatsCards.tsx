import { Card, CardContent } from "@/components/ui/card";

interface StatsCardsProps {
  todayOrders: number;
  todayRevenue: number;
  avgRating: number;
  menuItemsCount: number;
}

export default function StatsCards({ todayOrders, todayRevenue, avgRating, menuItemsCount }: StatsCardsProps) {
  const stats = [
    { label: "Today's Orders", value: todayOrders, icon: "fa-shopping-bag", color: "primary" },
    { label: "Revenue", value: `$${todayRevenue.toFixed(2)}`, icon: "fa-dollar-sign", color: "accent" },
    { label: "Avg Rating", value: avgRating.toFixed(1), icon: "fa-star", color: "yellow-500" },
    { label: "Menu Items", value: menuItemsCount, icon: "fa-utensils", color: "green-500" },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-2xl font-bold">{stat.value}</p>
            </div>
            <div className={`w-12 h-12 bg-${stat.color}/10 rounded-xl flex items-center justify-center`}>
              <i className={`fas ${stat.icon} text-${stat.color} text-xl`}></i>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
