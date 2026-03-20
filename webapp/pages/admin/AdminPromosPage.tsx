import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import PageHeader from "./components/PageHeader";
import StatusBadge from "./components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tag,
  Plus,
  Percent,
  DollarSign,
  Gift,
  Users,
  CreditCard,
  Inbox,
  Ban,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface PromoCode {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  min_order_amount: number;
  max_uses: number;
  times_used: number;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
}

interface ReferralStats {
  total_referral_codes: number;
  total_credits_issued: number;
  credits_redeemed: number;
  credits_pending: number;
}

interface CreatePromoForm {
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: string;
  min_order_amount: string;
  max_uses: string;
  expires_at: string;
}

const initialForm: CreatePromoForm = {
  code: "",
  discount_type: "percentage",
  discount_value: "",
  min_order_amount: "",
  max_uses: "0",
  expires_at: "",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Determine the display status of a promo code */
function getPromoStatus(promo: PromoCode): "active" | "expired" | "depleted" | "inactive" {
  if (!promo.is_active) return "inactive";
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) return "expired";
  if (promo.max_uses > 0 && promo.times_used >= promo.max_uses) return "depleted";
  return "active";
}

/** Format a date string for display */
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Never";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminPromosPage() {
  const { toast } = useToast();
  const [form, setForm] = useState<CreatePromoForm>(initialForm);

  // Fetch promo codes list
  const {
    data: promos,
    isLoading: promosLoading,
  } = useQuery<PromoCode[]>({
    queryKey: ["/api/payments/promo/list/"],
  });

  // Fetch referral stats
  const { data: referralStats } = useQuery<ReferralStats>({
    queryKey: ["/api/payments/referral/credits/"],
  });

  // Create promo mutation
  const createMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      return await apiRequest<PromoCode>("/api/payments/promo/create/", "POST", payload);
    },
    onSuccess: () => {
      toast({ title: "Promo Created", description: "The promo code has been created successfully." });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/promo/list/"] });
      setForm(initialForm);
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Create Promo",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  // Deactivate promo mutation
  const deactivateMutation = useMutation({
    mutationFn: async (promoId: string) => {
      return await apiRequest(`/api/payments/promo/${promoId}/deactivate/`, "POST");
    },
    onSuccess: () => {
      toast({ title: "Promo Deactivated", description: "The promo code has been deactivated." });
      queryClient.invalidateQueries({ queryKey: ["/api/payments/promo/list/"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to Deactivate",
        description: error.message || "Something went wrong.",
        variant: "destructive",
      });
    },
  });

  // Form handlers
  function updateField(field: keyof CreatePromoForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.code.trim()) {
      toast({ title: "Validation Error", description: "Promo code is required.", variant: "destructive" });
      return;
    }
    if (!form.discount_value || Number(form.discount_value) <= 0) {
      toast({ title: "Validation Error", description: "Discount value must be greater than 0.", variant: "destructive" });
      return;
    }

    const payload: Record<string, unknown> = {
      code: form.code.toUpperCase().trim(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      min_order_amount: Number(form.min_order_amount) || 0,
      max_uses: Number(form.max_uses) || 0,
    };
    if (form.expires_at) {
      payload.expires_at = new Date(form.expires_at).toISOString();
    }

    createMutation.mutate(payload);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Promo Codes"
        description="Create and manage promotional codes and campaigns."
      />

      {/* ── Main Content: Table + Form Side by Side ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        {/* LEFT: Promo Codes Table (60%) */}
        <Card className="xl:col-span-3 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Tag className="h-5 w-5 text-orange-500" />
              All Promo Codes
            </CardTitle>
            <CardDescription>
              {promos ? `${promos.length} promo code${promos.length !== 1 ? "s" : ""} total` : "Loading..."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Code</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Min Order</TableHead>
                    <TableHead>Uses / Max</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Loading state */}
                  {promosLoading &&
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        {Array.from({ length: 8 }).map((_, j) => (
                          <TableCell key={j}>
                            <Skeleton className="h-5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}

                  {/* Empty state */}
                  {!promosLoading && (!promos || promos.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={8} className="h-48">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Inbox className="h-10 w-10 mb-2 opacity-50" />
                          <p className="text-sm">No promo codes found</p>
                          <p className="text-xs mt-1">Create your first promo code using the form.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Data rows */}
                  {!promosLoading &&
                    promos?.map((promo) => {
                      const status = getPromoStatus(promo);
                      return (
                        <TableRow key={promo.id}>
                          <TableCell className="font-mono font-semibold text-sm">
                            {promo.code}
                          </TableCell>
                          <TableCell className="capitalize text-sm">
                            {promo.discount_type === "percentage" ? (
                              <span className="flex items-center gap-1">
                                <Percent className="h-3.5 w-3.5 text-muted-foreground" />
                                Percentage
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                                Fixed
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {promo.discount_type === "percentage"
                              ? `${promo.discount_value}%`
                              : `$${promo.discount_value.toFixed(2)}`}
                          </TableCell>
                          <TableCell className="text-sm">
                            ${promo.min_order_amount.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-sm">
                            {promo.times_used} / {promo.max_uses > 0 ? promo.max_uses : "Unlimited"}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={status} />
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {formatDate(promo.expires_at)}
                          </TableCell>
                          <TableCell>
                            {status === "active" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => deactivateMutation.mutate(promo.id)}
                                disabled={deactivateMutation.isPending}
                              >
                                <Ban className="h-3.5 w-3.5 mr-1" />
                                Deactivate
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Create Promo Form (40%) */}
        <Card className="xl:col-span-2 rounded-xl h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5 text-orange-500" />
              Create Promo Code
            </CardTitle>
            <CardDescription>
              Add a new promotional discount code.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Code */}
              <div className="space-y-2">
                <Label htmlFor="promo-code">Code</Label>
                <Input
                  id="promo-code"
                  placeholder="e.g. WELCOME20"
                  value={form.code}
                  onChange={(e) => updateField("code", e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                />
                <p className="text-xs text-muted-foreground">
                  Customers will enter this code at checkout.
                </p>
              </div>

              {/* Discount Type */}
              <div className="space-y-2">
                <Label htmlFor="discount-type">Discount Type</Label>
                <Select
                  value={form.discount_type}
                  onValueChange={(val) => updateField("discount_type", val)}
                >
                  <SelectTrigger id="discount-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Discount Value */}
              <div className="space-y-2">
                <Label htmlFor="discount-value">Discount Value</Label>
                <div className="relative">
                  <Input
                    id="discount-value"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={form.discount_type === "percentage" ? "e.g. 15" : "e.g. 5.00"}
                    value={form.discount_value}
                    onChange={(e) => updateField("discount_value", e.target.value)}
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                    {form.discount_type === "percentage" ? "%" : "$"}
                  </span>
                </div>
              </div>

              {/* Min Order Amount */}
              <div className="space-y-2">
                <Label htmlFor="min-order">Minimum Order Amount</Label>
                <div className="relative">
                  <Input
                    id="min-order"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 10.00"
                    value={form.min_order_amount}
                    onChange={(e) => updateField("min_order_amount", e.target.value)}
                    className="pr-10"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                    $
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Order must exceed this amount to apply the discount.
                </p>
              </div>

              {/* Max Uses */}
              <div className="space-y-2">
                <Label htmlFor="max-uses">Max Uses</Label>
                <Input
                  id="max-uses"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={form.max_uses}
                  onChange={(e) => updateField("max_uses", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Set to 0 for unlimited uses.
                </p>
              </div>

              {/* Expires At */}
              <div className="space-y-2">
                <Label htmlFor="expires-at">Expires At</Label>
                <Input
                  id="expires-at"
                  type="date"
                  value={form.expires_at}
                  onChange={(e) => updateField("expires_at", e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty for no expiration.
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Create Promo Code
                  </span>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* ── Bottom: Referral Program Stats ── */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gift className="h-5 w-5 text-orange-500" />
            Referral Program Stats
          </CardTitle>
          <CardDescription>
            Referral program: Users earn 15% off when they refer friends who spend $20+. Max 1 credit per order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-blue-50 p-2.5">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Referrals</p>
                <p className="text-xl font-bold">
                  {referralStats?.total_referral_codes ?? "--"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-emerald-50 p-2.5">
                <CreditCard className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Credits Earned</p>
                <p className="text-xl font-bold">
                  {referralStats?.total_credits_issued ?? "--"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-orange-50 p-2.5">
                <DollarSign className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Credits Redeemed</p>
                <p className="text-xl font-bold">
                  {referralStats?.credits_redeemed ?? "--"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
