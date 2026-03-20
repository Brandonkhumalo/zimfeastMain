import { useState, useEffect } from "react";
import PageHeader from "./components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  DollarSign,
  Gift,
  Gauge,
  Bell,
  Save,
  RotateCcw,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface CommissionSettings {
  platformCommissionRate: number;
  baseDeliveryFee: number;
  perKmDeliveryRate: number;
  minimumOrderAmount: number;
}

interface ReferralSettings {
  referralDiscountPercentage: number;
  minimumQualifyingOrder: number;
  maxCreditsPerOrder: number;
}

interface OperatingSettings {
  maxDeliveryRadius: number;
  driverOfferTimeout: number;
  maxScheduledOrderAdvance: number;
}

interface NotificationSettings {
  enableSms: boolean;
  enableEmail: boolean;
  enablePush: boolean;
}

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_COMMISSION: CommissionSettings = {
  platformCommissionRate: 15,
  baseDeliveryFee: 1.5,
  perKmDeliveryRate: 0.5,
  minimumOrderAmount: 5.0,
};

const DEFAULT_REFERRAL: ReferralSettings = {
  referralDiscountPercentage: 15,
  minimumQualifyingOrder: 20,
  maxCreditsPerOrder: 1,
};

const DEFAULT_OPERATING: OperatingSettings = {
  maxDeliveryRadius: 10,
  driverOfferTimeout: 30,
  maxScheduledOrderAdvance: 7,
};

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  enableSms: false,
  enableEmail: true,
  enablePush: true,
};

// ── localStorage keys ────────────────────────────────────────────────────────

const LS_COMMISSION = "zimfeast_settings_commission";
const LS_REFERRAL = "zimfeast_settings_referral";
const LS_OPERATING = "zimfeast_settings_operating";
const LS_NOTIFICATIONS = "zimfeast_settings_notifications";

// ── Helpers ──────────────────────────────────────────────────────────────────

function loadFromStorage<T>(key: string, defaults: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return { ...defaults, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore parse errors, use defaults
  }
  return defaults;
}

function saveToStorage(key: string, data: unknown) {
  localStorage.setItem(key, JSON.stringify(data));
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminSettingsPage() {
  const { toast } = useToast();

  // Load settings from localStorage on mount
  const [commission, setCommission] = useState<CommissionSettings>(() =>
    loadFromStorage(LS_COMMISSION, DEFAULT_COMMISSION)
  );
  const [referral, setReferral] = useState<ReferralSettings>(() =>
    loadFromStorage(LS_REFERRAL, DEFAULT_REFERRAL)
  );
  const [operating, setOperating] = useState<OperatingSettings>(() =>
    loadFromStorage(LS_OPERATING, DEFAULT_OPERATING)
  );
  const [notifications, setNotifications] = useState<NotificationSettings>(() =>
    loadFromStorage(LS_NOTIFICATIONS, DEFAULT_NOTIFICATIONS)
  );

  // Save handlers for each section
  function saveCommission() {
    saveToStorage(LS_COMMISSION, commission);
    toast({ title: "Commission Settings Saved", description: "Fee and commission settings have been updated." });
  }

  function saveReferral() {
    saveToStorage(LS_REFERRAL, referral);
    toast({ title: "Referral Settings Saved", description: "Referral program settings have been updated." });
  }

  function saveOperating() {
    saveToStorage(LS_OPERATING, operating);
    toast({ title: "Settings Saved", description: "Delivery settings have been updated." });
  }

  function saveNotifications() {
    saveToStorage(LS_NOTIFICATIONS, notifications);
    toast({ title: "Notification Settings Saved", description: "Notification preferences have been updated." });
  }

  function resetAll() {
    setCommission(DEFAULT_COMMISSION);
    setReferral(DEFAULT_REFERRAL);
    setOperating(DEFAULT_OPERATING);
    setNotifications(DEFAULT_NOTIFICATIONS);
    localStorage.removeItem(LS_COMMISSION);
    localStorage.removeItem(LS_REFERRAL);
    localStorage.removeItem(LS_OPERATING);
    localStorage.removeItem(LS_NOTIFICATIONS);
    toast({ title: "Settings Reset", description: "All settings have been restored to defaults." });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Configure platform fees, limits, and preferences."
        actions={
          <Button variant="outline" size="sm" className="gap-2" onClick={resetAll}>
            <RotateCcw className="h-4 w-4" />
            Reset All to Defaults
          </Button>
        }
      />

      {/* ── Section 1: Commission & Fees ── */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-orange-500" />
            Commission & Fees
          </CardTitle>
          <CardDescription>
            Configure the platform commission rate and delivery fees.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Platform Commission Rate */}
            <div className="space-y-2">
              <Label htmlFor="commission-rate">Platform Commission Rate</Label>
              <div className="relative">
                <Input
                  id="commission-rate"
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={commission.platformCommissionRate}
                  onChange={(e) =>
                    setCommission((prev) => ({
                      ...prev,
                      platformCommissionRate: Number(e.target.value),
                    }))
                  }
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Percentage taken from each restaurant order.
              </p>
            </div>

            {/* Base Delivery Fee */}
            <div className="space-y-2">
              <Label htmlFor="base-delivery">Base Delivery Fee</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  $
                </span>
                <Input
                  id="base-delivery"
                  type="number"
                  min="0"
                  step="0.25"
                  value={commission.baseDeliveryFee}
                  onChange={(e) =>
                    setCommission((prev) => ({
                      ...prev,
                      baseDeliveryFee: Number(e.target.value),
                    }))
                  }
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Flat fee charged for every delivery.
              </p>
            </div>

            {/* Per-km Delivery Rate */}
            <div className="space-y-2">
              <Label htmlFor="per-km-rate">Per-km Delivery Rate</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  $
                </span>
                <Input
                  id="per-km-rate"
                  type="number"
                  min="0"
                  step="0.10"
                  value={commission.perKmDeliveryRate}
                  onChange={(e) =>
                    setCommission((prev) => ({
                      ...prev,
                      perKmDeliveryRate: Number(e.target.value),
                    }))
                  }
                  className="pl-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  /km
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Additional charge per kilometer of delivery distance.
              </p>
            </div>

            {/* Minimum Order Amount */}
            <div className="space-y-2">
              <Label htmlFor="min-order">Minimum Order Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  $
                </span>
                <Input
                  id="min-order"
                  type="number"
                  min="0"
                  step="0.50"
                  value={commission.minimumOrderAmount}
                  onChange={(e) =>
                    setCommission((prev) => ({
                      ...prev,
                      minimumOrderAmount: Number(e.target.value),
                    }))
                  }
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Orders below this amount will not be accepted.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              className="bg-orange-500 hover:bg-orange-600 gap-2"
              onClick={saveCommission}
            >
              <Save className="h-4 w-4" />
              Save Commission Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Referral Program ── */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gift className="h-5 w-5 text-orange-500" />
            Referral Program
          </CardTitle>
          <CardDescription>
            Configure the customer referral incentive program.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Referral Discount */}
            <div className="space-y-2">
              <Label htmlFor="referral-discount">Referral Discount</Label>
              <div className="relative">
                <Input
                  id="referral-discount"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={referral.referralDiscountPercentage}
                  onChange={(e) =>
                    setReferral((prev) => ({
                      ...prev,
                      referralDiscountPercentage: Number(e.target.value),
                    }))
                  }
                  className="pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  %
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Discount given to referred customers.
              </p>
            </div>

            {/* Min Qualifying Order */}
            <div className="space-y-2">
              <Label htmlFor="min-qualifying">Min Qualifying Order</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">
                  $
                </span>
                <Input
                  id="min-qualifying"
                  type="number"
                  min="0"
                  step="1"
                  value={referral.minimumQualifyingOrder}
                  onChange={(e) =>
                    setReferral((prev) => ({
                      ...prev,
                      minimumQualifyingOrder: Number(e.target.value),
                    }))
                  }
                  className="pl-8"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Minimum order for referral credit.
              </p>
            </div>

            {/* Max Credits Per Order */}
            <div className="space-y-2">
              <Label htmlFor="max-credits">Max Credits Per Order</Label>
              <Input
                id="max-credits"
                type="number"
                min="0"
                step="1"
                value={referral.maxCreditsPerOrder}
                onChange={(e) =>
                  setReferral((prev) => ({
                    ...prev,
                    maxCreditsPerOrder: Number(e.target.value),
                  }))
                }
              />
              <p className="text-xs text-muted-foreground">
                Maximum referral credits usable per order.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              className="bg-orange-500 hover:bg-orange-600 gap-2"
              onClick={saveReferral}
            >
              <Save className="h-4 w-4" />
              Save Referral Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Operating Limits ── */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Gauge className="h-5 w-5 text-orange-500" />
            Delivery Settings
          </CardTitle>
          <CardDescription>
            Set delivery radius, timeouts, and scheduling limits.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* Max Delivery Radius */}
            <div className="space-y-2">
              <Label htmlFor="max-radius">Max Delivery Radius</Label>
              <div className="relative">
                <Input
                  id="max-radius"
                  type="number"
                  min="1"
                  step="0.5"
                  value={operating.maxDeliveryRadius}
                  onChange={(e) =>
                    setOperating((prev) => ({
                      ...prev,
                      maxDeliveryRadius: Number(e.target.value),
                    }))
                  }
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  km
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Maximum distance for delivery orders.
              </p>
            </div>

            {/* Driver Offer Timeout */}
            <div className="space-y-2">
              <Label htmlFor="offer-timeout">Driver Offer Timeout</Label>
              <div className="relative">
                <Input
                  id="offer-timeout"
                  type="number"
                  min="10"
                  step="5"
                  value={operating.driverOfferTimeout}
                  onChange={(e) =>
                    setOperating((prev) => ({
                      ...prev,
                      driverOfferTimeout: Number(e.target.value),
                    }))
                  }
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  sec
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Time before a delivery offer expires.
              </p>
            </div>

            {/* Max Scheduled Order Advance */}
            <div className="space-y-2">
              <Label htmlFor="max-advance">Max Schedule Days</Label>
              <div className="relative">
                <Input
                  id="max-advance"
                  type="number"
                  min="1"
                  step="1"
                  value={operating.maxScheduledOrderAdvance}
                  onChange={(e) =>
                    setOperating((prev) => ({
                      ...prev,
                      maxScheduledOrderAdvance: Number(e.target.value),
                    }))
                  }
                  className="pr-14"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  days
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                How far in advance orders can be scheduled.
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              className="bg-orange-500 hover:bg-orange-600 gap-2"
              onClick={saveOperating}
            >
              <Save className="h-4 w-4" />
              Save Delivery Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Notifications ── */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-orange-500" />
            Notifications
          </CardTitle>
          <CardDescription>
            Enable or disable notification channels for the platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* SMS */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">SMS Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send order updates and alerts via SMS.
                </p>
              </div>
              <Switch
                checked={notifications.enableSms}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({ ...prev, enableSms: checked }))
                }
              />
            </div>

            {/* Email */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Email Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send order confirmations and marketing emails.
                </p>
              </div>
              <Switch
                checked={notifications.enableEmail}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({ ...prev, enableEmail: checked }))
                }
              />
            </div>

            {/* Push */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Push Notifications</Label>
                <p className="text-xs text-muted-foreground">
                  Send real-time push notifications to mobile and web apps.
                </p>
              </div>
              <Switch
                checked={notifications.enablePush}
                onCheckedChange={(checked) =>
                  setNotifications((prev) => ({ ...prev, enablePush: checked }))
                }
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              className="bg-orange-500 hover:bg-orange-600 gap-2"
              onClick={saveNotifications}
            >
              <Save className="h-4 w-4" />
              Save Notification Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
