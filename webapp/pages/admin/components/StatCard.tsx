import { type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ColorVariant = "orange" | "green" | "blue" | "red" | "purple" | "yellow" | "zinc";

const colorMap: Record<ColorVariant, { bg: string; icon: string; text: string }> = {
  orange: { bg: "bg-orange-50", icon: "text-orange-600", text: "text-orange-600" },
  green:  { bg: "bg-emerald-50", icon: "text-emerald-600", text: "text-emerald-600" },
  blue:   { bg: "bg-blue-50", icon: "text-blue-600", text: "text-blue-600" },
  red:    { bg: "bg-red-50", icon: "text-red-600", text: "text-red-600" },
  purple: { bg: "bg-purple-50", icon: "text-purple-600", text: "text-purple-600" },
  yellow: { bg: "bg-amber-50", icon: "text-amber-600", text: "text-amber-600" },
  zinc:   { bg: "bg-zinc-100", icon: "text-zinc-600", text: "text-zinc-600" },
};

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    positive?: boolean;
  };
  icon: LucideIcon;
  color?: ColorVariant;
  className?: string;
}

export default function StatCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  color = "orange",
  className,
}: StatCardProps) {
  const colors = colorMap[color];

  return (
    <Card className={cn("hover:shadow-md transition-shadow", className)}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {trend && (
              <p
                className={cn(
                  "text-xs font-medium",
                  trend.positive ? "text-emerald-600" : "text-red-600"
                )}
              >
                {trend.positive ? "\u2191" : "\u2193"} {trend.value}
              </p>
            )}
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className={cn("rounded-lg p-2.5", colors.bg)}>
            <Icon className={cn("h-5 w-5", colors.icon)} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
