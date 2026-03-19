import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EarningsOverviewProps {
  earnings: {
    today: number;
    week: number;
    month: number;
    total: number;
  };
}

export default function EarningsOverview({ earnings }: EarningsOverviewProps) {
  const weekData = [
    { day: 'Mon', amount: earnings.week / 7, height: 12 },
    { day: 'Tue', amount: earnings.week / 7, height: 16 },
    { day: 'Wed', amount: earnings.week / 7, height: 10 },
    { day: 'Thu', amount: earnings.week / 7, height: 14 },
    { day: 'Fri', amount: earnings.week / 7, height: 18 },
    { day: 'Sat', amount: 0, height: 4 },
    { day: 'Sun', amount: 0, height: 4 },
  ];

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle>This Week's Earnings</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-4">
          {weekData.map((data, index) => (
            <div key={index} className="text-center">
              <p className="text-xs text-muted-foreground mb-2">{data.day}</p>
              <div className="bg-muted h-20 rounded-lg flex items-end justify-center">
                <div className={`w-4 rounded-t bg-primary`} style={{ height: `${data.height * 4}px` }} />
              </div>
              <p className="text-sm font-medium mt-2">${data.amount.toFixed(2)}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 text-center text-sm text-muted-foreground">
          Total earnings this week: <span className="font-medium text-foreground">${earnings.week.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
