import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/apiRequest";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, Users, DollarSign, Plus, Trash2 } from "lucide-react";

interface CorporateAccount {
  id: string;
  company_name: string;
  billing_email: string;
  monthly_spending_limit: number;
  current_month_spending: number;
  employee_count: number;
  is_active: boolean;
}

interface Employee {
  id: string;
  user_id: string;
  email: string;
  name: string;
  personal_spending_limit: number;
  current_month_spending: number;
  requires_approval: boolean;
  is_active: boolean;
}

export default function CorporateDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [showAddEmployee, setShowAddEmployee] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ email: "", spending_limit: "100", requires_approval: false });

  const { data: account, isLoading: accountLoading } = useQuery<CorporateAccount>({
    queryKey: ["corporate-account"],
    queryFn: () => apiRequest<CorporateAccount>("/api/accounts/corporate/"),
  });

  const { data: employeesData, isLoading: employeesLoading, refetch: refetchEmployees } = useQuery<{ results: Employee[] }>({
    queryKey: ["corporate-employees"],
    queryFn: () => apiRequest<{ results: Employee[] }>("/api/accounts/corporate/employees/"),
  });

  const addEmployeeMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("/api/accounts/corporate/employees/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      toast({ title: "Employee added" });
      setShowAddEmployee(false);
      setNewEmployee({ email: "", spending_limit: "100", requires_approval: false });
      refetchEmployees();
    },
    onError: () => toast({ title: "Error", description: "Failed to add employee", variant: "destructive" }),
  });

  const removeEmployeeMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest(`/api/accounts/corporate/employees/${id}/`, { method: "DELETE" }),
    onSuccess: () => {
      toast({ title: "Employee removed" });
      refetchEmployees();
    },
  });

  const employees = employeesData?.results ?? [];
  const remainingBudget = account
    ? account.monthly_spending_limit - account.current_month_spending
    : 0;

  if (accountLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="max-w-lg mx-auto p-6 mt-20 text-center">
        <Building2 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-2xl font-bold mb-2">No Corporate Account</h2>
        <p className="text-muted-foreground">Contact support to set up a corporate account for your business.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{account.company_name}</h1>
          <p className="text-muted-foreground">Corporate Dashboard</p>
        </div>
        <Badge variant={account.is_active ? "default" : "destructive"}>
          {account.is_active ? "Active" : "Suspended"}
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Employees</p>
              <p className="text-xl font-bold">{employees.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Spent This Month</p>
              <p className="text-xl font-bold">${account.current_month_spending.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-orange-100 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Budget Remaining</p>
              <p className="text-xl font-bold">${remainingBudget.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Employees */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg">Employees</CardTitle>
          <Button size="sm" onClick={() => setShowAddEmployee(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Add Employee
          </Button>
        </CardHeader>
        <CardContent>
          {employeesLoading ? (
            <Skeleton className="h-32 w-full rounded" />
          ) : employees.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No employees added yet.</p>
          ) : (
            <div className="space-y-3">
              {employees.map((emp) => (
                <div key={emp.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{emp.name || emp.email}</p>
                    <p className="text-sm text-muted-foreground">{emp.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">
                        Spent: ${emp.current_month_spending.toFixed(2)} / ${emp.personal_spending_limit.toFixed(2)}
                      </span>
                      {emp.requires_approval && (
                        <Badge variant="outline" className="text-xs">Requires Approval</Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500"
                    onClick={() => removeEmployeeMutation.mutate(emp.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Employee Dialog */}
      <Dialog open={showAddEmployee} onOpenChange={setShowAddEmployee}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Employee email address"
              value={newEmployee.email}
              onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Monthly spending limit ($)"
              value={newEmployee.spending_limit}
              onChange={(e) => setNewEmployee({ ...newEmployee, spending_limit: e.target.value })}
            />
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={newEmployee.requires_approval}
                onChange={(e) => setNewEmployee({ ...newEmployee, requires_approval: e.target.checked })}
              />
              <span className="text-sm">Require approval for each order</span>
            </label>
            <Button
              onClick={() => addEmployeeMutation.mutate({
                email: newEmployee.email,
                personal_spending_limit: parseFloat(newEmployee.spending_limit),
                requires_approval: newEmployee.requires_approval,
              })}
              disabled={!newEmployee.email || addEmployeeMutation.isPending}
              className="w-full"
            >
              {addEmployeeMutation.isPending ? "Adding..." : "Add Employee"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
