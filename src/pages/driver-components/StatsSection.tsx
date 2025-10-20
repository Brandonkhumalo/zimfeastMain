import { Card, CardContent } from "@/components/ui/card";

interface StatsSectionProps {
  todayEarnings: number;
  todayDeliveries: number;
  rating: number;
  hoursOnline: number;
}

export default function StatsSection({
  todayEarnings,
  todayDeliveries,
  rating,
  hoursOnline,
}: StatsSectionProps) {
  return (
    <section className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Today's Earnings</p>
          <p className="text-2xl font-bold">${todayEarnings.toFixed(2)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Deliveries</p>
          <p className="text-2xl font-bold">{todayDeliveries}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Rating</p>
          <p className="text-2xl font-bold">{rating.toFixed(1)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Hours Online</p>
          <p className="text-2xl font-bold">{hoursOnline}h</p>
        </CardContent>
      </Card>
    </section>
  );
}
