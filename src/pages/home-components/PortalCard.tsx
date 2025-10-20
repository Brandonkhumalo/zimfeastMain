import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PortalCardProps {
  title: string;
  description: string;
  iconClass: string;
  iconBgClass: string;
  buttonText: string;
  buttonVariant?: "default" | "secondary" | "outline";
  onClick: () => void;
  buttonClass?: string;
}

export function PortalCard({
  title,
  description,
  iconClass,
  iconBgClass,
  buttonText,
  buttonVariant = "default",
  onClick,
  buttonClass,
}: PortalCardProps) {
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      <CardContent className="p-8 text-center">
        <div className={`w-20 h-20 ${iconBgClass} rounded-full flex items-center justify-center mx-auto mb-6`}>
          <i className={`${iconClass} text-3xl`}></i>
        </div>
        <h3 className="text-xl font-semibold mb-3">{title}</h3>
        <p className="text-muted-foreground mb-6">{description}</p>
        <Button 
          variant={buttonVariant} 
          className={`w-full ${buttonClass}`}
        >
          {buttonText}
        </Button>
      </CardContent>
    </Card>
  );
}
