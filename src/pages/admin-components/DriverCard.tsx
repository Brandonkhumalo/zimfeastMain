import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "./StatusBadge";
import { DriverApplication } from "./types";
import { MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  driver: DriverApplication;
  onReview: (app: DriverApplication, action: 'approve' | 'reject') => void;
}

export default function DriverCard({ driver, onReview }: Props) {
  return (
    <Card className={driver.approvalStatus === 'pending' ? 'border-yellow-200' : ''}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-lg">{driver.userName}</h3>
              <StatusBadge status={driver.approvalStatus} />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div><strong>Email:</strong> {driver.userEmail}</div>
              <div><strong>Vehicle:</strong> {driver.vehicleType} - {driver.vehicleNumber}</div>
              <div><strong>License:</strong> {driver.licenseNumber}</div>
              <div><strong>Applied:</strong> {driver.createdAt ? new Date(driver.createdAt).toLocaleDateString() : 'N/A'}</div>
            </div>
            {driver.approvalComments && (
              <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertDescription>{driver.approvalComments}</AlertDescription>
              </Alert>
            )}
          </div>

          {driver.approvalStatus === 'pending' && (
            <div className="flex gap-2">
              <Button onClick={() => onReview(driver, 'approve')} className="bg-green-600 hover:bg-green-700" size="sm">Approve</Button>
              <Button onClick={() => onReview(driver, 'reject')} variant="destructive" size="sm">Reject</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
