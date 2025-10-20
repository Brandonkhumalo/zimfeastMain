import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/Navbar";
import { toggleDriverStatus, getDriverStatus, getActiveDriverOrders } from "./driver-components/driverApi";

// Child Components
import Header from "./driver-components/Header";
import StatsSection from "./driver-components/StatsSection";
import ActiveDeliveries from "./driver-components/ActiveDeliveries";
import DeliveryHistory from "./driver-components/DeliveryHistory";
import EarningsOverview from "./driver-components/EarningsOverview";

// Role Guard
import { withRoleGuard } from "@/lib/withRoleGuard";

// Types
import { Order, Driver } from "./driver-components/types";

interface EarningsData {
  today: number;
  week: number;
  month: number;
  total: number;
}

interface StatsData {
  deliveriesToday: number;
  hoursOnline: number;
}

function DriverAppInner() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [isOnline, setIsOnline] = useState(false);

  // Fetch driver status
  const { refetch: refetchStatus } = useQuery({
    queryKey: ["driver-status", user?.id],
    queryFn: async () => {
      const res = await getDriverStatus();
      setIsOnline(res.is_online);
      return res;
    },
    enabled: isAuthenticated && !!user,
  });

  // Toggle online/offline
  const toggleOnlineMutation = useMutation({
    mutationFn: async () => {
      const res = await toggleDriverStatus();
      setIsOnline(res.is_online);
      return res.is_online;
    },
    onSuccess: (isNowOnline) => {
      toast({
        title: isNowOnline ? "Gone Online" : "Gone Offline",
        description: isNowOnline ? "Ready for deliveries" : "You are offline",
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to change status",
        variant: "destructive",
      });
    },
  });

  // Fetch active deliveries from backend
  const { data: activeDeliveries, isLoading: activeDeliveriesLoading } = useQuery<Order[]>({
  queryKey: ["driver-active-orders", user?.id],
  queryFn: async () => {
    // Uncomment the next lines to fetch from backend
    // const res = await getActiveDriverOrders(); // returns {id, status, fee, location}[]
    // return res.map(o => ({
    //   id: o.id,
    //   status: o.status,
    //   deliveryFee: o.fee,
    //   deliveryAddress: o.location || "",
    //   customerName: "Unknown",
    //   customerPhone: "Unknown",
    //   driverId: user?.id,
    // }));

    // DEMO DATA
    return [
      {
        id: "11111111-1111-1111-1111-111111111111",
        status: "accepted",
        deliveryFee: 5.0,
        deliveryAddress: "123 Main Street",
        customerName: "John Doe",
        customerPhone: "+263771234567",
        driverId: user?.id,
      },
      {
        id: "22222222-2222-2222-2222-222222222222",
        status: "delivering",
        deliveryFee: 7.5,
        deliveryAddress: "456 Second Ave",
        customerName: "Jane Smith",
        customerPhone: "+263778765432",
        driverId: user?.id,
      },
    ];
  },
  enabled: isAuthenticated && !!user,
});

  // Other queries
  const { data: driverProfile } = useQuery<Driver>({
    queryKey: ["driver-profile", user?.id],
    enabled: isAuthenticated && !!user,
  });

  const { data: earningsData } = useQuery<EarningsData>({
    queryKey: ["driver-earnings", user?.id],
    enabled: isAuthenticated && !!user,
  });

  // Fetch driver daily finance (StatsSection data)
const { data: statsData } = useQuery({
  queryKey: ["driver-daily-finance", user?.id],
  queryFn: async () => {
    // Uncomment to fetch from backend
    // const res = await fetch(`/api/drivers/daily/finance/`);
    // const json = await res.json();
    // return json;

    // DEMO DATA
    return {
      today_deliveries: 4,
      today_earnings: 42.75,
      average_rating: 4.8,
      hours_online: 5.5,
    };
  },
  enabled: isAuthenticated && !!user,
});

  if (isLoading || activeDeliveriesLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Header user={user} isOnline={isOnline} toggleOnlineMutation={toggleOnlineMutation} />

      <StatsSection
        todayEarnings={statsData?.today_earnings ?? 0}
        todayDeliveries={statsData?.today_deliveries ?? 0}
        rating={statsData?.average_rating ?? 0}
        hoursOnline={statsData?.hours_online ?? 0}
      />

      <ActiveDeliveries
        activeDeliveries={activeDeliveries ?? []}
        assignedOrder={null} />

      <DeliveryHistory />
    </div>
  );
}

export default withRoleGuard(DriverAppInner, ["driver", "admin"]);
