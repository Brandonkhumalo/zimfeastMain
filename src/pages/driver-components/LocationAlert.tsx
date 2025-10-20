import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LocationAlertProps {
  requestPermission: () => void;
}

export default function LocationAlert({ requestPermission }: LocationAlertProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Location access is required to receive delivery requests.
          <Button
            variant="link"
            className="p-0 h-auto ml-1"
            onClick={requestPermission}
            data-testid="button-enable-location"
          >
            Enable now
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  );
}
