import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import PageHeader from "./components/PageHeader";
import StatCard from "./components/StatCard";
import { Building2, Users, DollarSign, TrendingUp } from "lucide-react";

interface UserRecord {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
}

export default function AdminCorporatePage() {
  // Fetch corporate admin users to display corporate accounts
  const { data: usersData, isLoading } = useQuery<{ results: UserRecord[]; total: number }>({
    queryKey: ["admin-corporate-users"],
    queryFn: () =>
      apiRequest<{ results: UserRecord[]; total: number }>(
        "/api/accounts/admin/all-users/?role=corporate_admin"
      ),
  });

  const corporateUsers = usersData?.results ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corporate Accounts"
        description="Manage business accounts with employee sub-accounts and monthly invoicing."
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Corporate Accounts"
          value={corporateUsers.length}
          icon={Building2}
          color="blue"
        />
        <StatCard
          title="Active"
          value={corporateUsers.filter((u) => u.is_active).length}
          icon={TrendingUp}
          color="green"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : corporateUsers.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Building2 className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium text-muted-foreground">No corporate accounts yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Corporate accounts are created when businesses register through the platform.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {corporateUsers.map((user) => (
            <Card key={user.id} className="shadow-sm">
              <CardContent className="p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={user.is_active ? "default" : "secondary"}>
                    {user.is_active ? "Active" : "Inactive"}
                  </Badge>
                  <Badge variant="outline">Corporate Admin</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
