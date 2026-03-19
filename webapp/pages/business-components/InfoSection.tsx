import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function InfoSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <i className="fas fa-store text-primary"></i>
            Restaurant Partners
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {[
              "Reach thousands of hungry customers",
              "Real-time order management",
              "Secure PayNow payment processing",
              "Professional marketing support",
            ].map((text, i) => (
              <li key={i} className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>{text}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <i className="fas fa-motorcycle text-primary"></i>
            Delivery Drivers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {[
              "Flexible working hours",
              "Weekly cash payments",
              "GPS tracking and navigation",
              "24/7 support team",
            ].map((text, i) => (
              <li key={i} className="flex items-center gap-2">
                <i className="fas fa-check text-green-500"></i>{text}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
