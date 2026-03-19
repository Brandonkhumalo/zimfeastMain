import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import Navbar from "@/components/Navbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Store, Truck } from "lucide-react";
import RestaurantCard from "./admin-components/RestaurantCard";
import DriverCard from "./admin-components/DriverCard";
import { RestaurantApplication, DriverApplication } from "./admin-components/types";

// Wrap applications with type
type SelectedApplication = (RestaurantApplication | DriverApplication) & { type: 'restaurant' | 'driver' };

export default function AdminDashboard() {
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedApp, setSelectedApp] = useState<SelectedApplication | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject' | null>(null);
  const [reviewComments, setReviewComments] = useState("");
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false);

  //the actual API calls are happening inside "@/lib/queryClient"
  const { data: userProfile } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    enabled: !!user,
  });
  const isAdmin = userProfile?.role === 'admin';

  const { data: restaurantApps } = useQuery<RestaurantApplication[]>({
    queryKey: ['/api/admin/restaurant-applications'],
    enabled: isAuthenticated && isAdmin,
  });

  const { data: driverApps } = useQuery<DriverApplication[]>({
    queryKey: ['/api/admin/driver-applications'],
    enabled: isAuthenticated && isAdmin,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ type, id, action, comments }: { type: 'restaurant' | 'driver'; id: string; action: 'approve' | 'reject'; comments: string }) => {
      return await apiRequest("POST", `/api/admin/${type}-applications/${id}/review`, { action, comments });
    },
    onSuccess: (data, variables) => {
      toast({ title: "Application Reviewed", description: `${variables.type} application ${variables.action}d`, variant: "default" });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/restaurant-applications'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/driver-applications'] });
      setIsReviewDialogOpen(false);
      setSelectedApp(null);
      setReviewAction(null);
      setReviewComments("");
    },
    onError: (error: any) => {
      toast({ title: "Review Failed", description: error.message || "Failed to review application", variant: "destructive" });
    }
  });

  const handleReview = (app: RestaurantApplication | DriverApplication, type: 'restaurant' | 'driver', action: 'approve' | 'reject') => {
    setSelectedApp({ ...app, type });
    setReviewAction(action);
    setIsReviewDialogOpen(true);
  };

  const submitReview = () => {
    if (!selectedApp || !reviewAction) return;
    reviewMutation.mutate({ type: selectedApp.type, id: selectedApp.id, action: reviewAction, comments: reviewComments });
  };

  if (!isAuthenticated) return <div>Please login as admin</div>;
  //if (!isAdmin) return <div>Access Denied</div>;

  const pendingRestaurants = restaurantApps?.filter(app => app.approvalStatus === 'pending') || [];
  const pendingDrivers = driverApps?.filter(app => app.approvalStatus === 'pending') || [];

  const getAppName = (app: SelectedApplication | null) => {
    if (!app) return '';
    return 'name' in app ? app.name : app.userName;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2"><CardTitle>Pending Restaurants</CardTitle></CardHeader>
            <CardContent>{pendingRestaurants.length}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle>Pending Drivers</CardTitle></CardHeader>
            <CardContent>{pendingDrivers.length}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle>Total Restaurants</CardTitle></CardHeader>
            <CardContent>{restaurantApps?.length || 0}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle>Total Drivers</CardTitle></CardHeader>
            <CardContent>{driverApps?.length || 0}</CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Card>
          <CardHeader><CardTitle>Business Applications</CardTitle></CardHeader>
          <CardContent>
            <Tabs defaultValue="restaurants">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="restaurants"><Store className="w-4 h-4 mr-2" />Restaurants ({pendingRestaurants.length})</TabsTrigger>
                <TabsTrigger value="drivers"><Truck className="w-4 h-4 mr-2" />Drivers ({pendingDrivers.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="restaurants" className="space-y-4">
                {restaurantApps?.map(r => (
                  <RestaurantCard key={r.id} restaurant={r} onReview={(app, action) => handleReview(app, 'restaurant', action)} />
                ))}
              </TabsContent>

              <TabsContent value="drivers" className="space-y-4">
                {driverApps?.map(d => (
                  <DriverCard key={d.id} driver={d} onReview={(app, action) => handleReview(app, 'driver', action)} />
                ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Review Dialog */}
      <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{reviewAction === 'approve' ? 'Approve' : 'Reject'} Application</DialogTitle>
            <DialogDescription>
              {reviewAction
                ? `${reviewAction === 'approve' ? 'Approve' : 'Reject'} ${getAppName(selectedApp)}?`
                : ''}
            </DialogDescription>
          </DialogHeader>

          <Textarea
            value={reviewComments}
            onChange={e => setReviewComments(e.target.value)}
            placeholder={reviewAction === 'reject' ? 'Reason...' : 'Notes...'}
            className="mt-2"
          />

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReviewDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={submitReview}
              disabled={reviewMutation.isPending || (reviewAction === 'reject' && !reviewComments.trim())}
            >
              {reviewAction === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
