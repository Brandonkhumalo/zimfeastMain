import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatusBadge from "./StatusBadge";
import { RestaurantApplication } from "./types";
import { MessageSquare } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Props {
  restaurant: RestaurantApplication;
  onReview: (app: RestaurantApplication, action: 'approve' | 'reject') => void;
}

export default function RestaurantCard({ restaurant, onReview }: Props) {
  return (
    <Card className={restaurant.approvalStatus === 'pending' ? 'border-yellow-200' : ''}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="font-semibold text-lg">{restaurant.name}</h3>
              <StatusBadge status={restaurant.approvalStatus} />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div><strong>Owner:</strong> {restaurant.ownerName} ({restaurant.ownerEmail})</div>
              <div><strong>Cuisine:</strong> {restaurant.cuisineType}</div>
              <div><strong>Address:</strong> {restaurant.address}, {restaurant.city}</div>
              <div><strong>Phone:</strong> {restaurant.phone}</div>
              <div><strong>Delivery Fee:</strong> ${restaurant.deliveryFee}</div>
              <div><strong>Applied:</strong> {restaurant.createdAt ? new Date(restaurant.createdAt).toLocaleDateString() : 'N/A'}</div>
            </div>
            {restaurant.description && <p className="text-sm text-muted-foreground">{restaurant.description}</p>}
            {restaurant.approvalComments && (
              <Alert>
                <MessageSquare className="h-4 w-4" />
                <AlertDescription>{restaurant.approvalComments}</AlertDescription>
              </Alert>
            )}
          </div>

          {restaurant.approvalStatus === 'pending' && (
            <div className="flex gap-2">
              <Button onClick={() => onReview(restaurant, 'approve')} className="bg-green-600 hover:bg-green-700" size="sm">Approve</Button>
              <Button onClick={() => onReview(restaurant, 'reject')} variant="destructive" size="sm">Reject</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
