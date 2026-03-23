import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import PageHeader from "./components/PageHeader";
import { CheckCircle, XCircle, Clock, Truck } from "lucide-react";

interface PendingDriver {
  id: string;
  user_id: string;
  license_number: string;
  vehicle_details?: any;
  lat?: number;
  lng?: number;
  created_at: string;
}

interface PendingResponse {
  results: PendingDriver[];
  total: number;
  page: number;
  page_size: number;
}

export default function AdminPendingDriversPage() {
  const { toast } = useToast();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  const { data, isLoading, refetch } = useQuery<PendingResponse>({
    queryKey: ["admin-pending-drivers"],
    queryFn: () => apiRequest<PendingResponse>("/api/drivers/admin/pending/"),
  });

  const approveMutation = useMutation({
    mutationFn: (driverId: string) =>
      apiRequest(`/api/drivers/admin/${driverId}/approve/`, { method: "POST" }),
    onSuccess: () => {
      toast({ title: "Driver approved", description: "The driver can now go online." });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-drivers"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to approve driver", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ driverId, notes }: { driverId: string; notes: string }) =>
      apiRequest(`/api/drivers/admin/${driverId}/reject/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      }),
    onSuccess: () => {
      toast({ title: "Driver rejected", description: "The driver has been notified." });
      setRejectingId(null);
      setRejectNotes("");
      refetch();
    },
    onError: () => toast({ title: "Error", description: "Failed to reject driver", variant: "destructive" }),
  });

  const drivers = data?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pending Driver Approvals"
        description="Review and approve new driver registrations."
      />

      <div className="flex items-center gap-3 mb-4">
        <Badge variant="outline" className="text-sm gap-1.5 py-1">
          <Clock className="h-3.5 w-3.5" />
          {data?.total ?? 0} pending
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      ) : drivers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
            <p className="text-lg font-medium text-muted-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">No pending driver applications.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {drivers.map((driver) => (
            <Card key={driver.id} className="shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                      <Truck className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-lg">Driver {driver.id.slice(0, 8)}</p>
                      <p className="text-sm text-muted-foreground">User: {driver.user_id.slice(0, 8)}...</p>
                      <p className="text-sm text-muted-foreground">License: {driver.license_number || "N/A"}</p>
                      {driver.vehicle_details && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Vehicle: {typeof driver.vehicle_details === "object"
                            ? JSON.stringify(driver.vehicle_details)
                            : driver.vehicle_details}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Applied: {new Date(driver.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {rejectingId === driver.id ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Rejection reason (optional)..."
                          value={rejectNotes}
                          onChange={(e) => setRejectNotes(e.target.value)}
                          className="min-w-[250px]"
                          rows={2}
                        />
                        <div className="flex gap-2 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setRejectingId(null); setRejectNotes(""); }}
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => rejectMutation.mutate({ driverId: driver.id, notes: rejectNotes })}
                            disabled={rejectMutation.isPending}
                          >
                            Confirm Reject
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => setRejectingId(driver.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => approveMutation.mutate(driver.id)}
                          disabled={approveMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
