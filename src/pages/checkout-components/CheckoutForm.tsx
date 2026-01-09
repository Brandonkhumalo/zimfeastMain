import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { MobilePaymentFields } from "./MobilePaymentFields";
import { DELIVERY_RATE_PER_KM } from "@shared/deliveryUtils";

interface OrderItem {
  name: string;
  quantity: number;
  price: string;
}

interface Order {
  id: string;
  total_fee: string;
  tip: string;
  items: OrderItem[];
  each_item_price: OrderItem[];
  restaurant_names: string[];
  delivery_fee: number;
  status: string;
  currency?: string;
}

interface CheckoutFormProps {
  orderId: string;
}

export const CheckoutForm = ({ orderId }: CheckoutFormProps) => {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [paymentMethod, setPaymentMethod] = useState<"web" | "mobile" | "voucher">("web");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [mobileProvider, setMobileProvider] = useState("");
  const [depositAmount, setDepositAmount] = useState("");
  const [voucherBalance, setVoucherBalance] = useState<number | null>(null);

  // --- Fetch order details ---
  const { data: currentOrder, isLoading } = useQuery<Order>({
    queryKey: [`/api/orders/order/${orderId}`],
    queryFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/orders/order/${orderId}/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch order details");
      return res.json();
    },
  });

  // --- Fetch Feast Voucher Balance ---
  useEffect(() => {
    if (paymentMethod === "voucher") {
      const fetchBalance = async () => {
        const token = localStorage.getItem("token");
        const res = await fetch("/api/payments/feast/voucher/balance/", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setVoucherBalance(Number(data.balance));
      };
      fetchBalance();
    }
  }, [paymentMethod]);

  // --- Normalize mobile phone ---
  const normalizePhone = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    if (clean.startsWith("0")) return "+263" + clean.slice(1);
    if (clean.startsWith("263")) return "+" + clean;
    if (clean.startsWith("+")) return clean;
    return "+263" + clean;
  };

  // --- Payment Mutation ---
  const paymentMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("token");

      // Always include order_id in request body
      const body: any = {
        order_id: orderId,
        method: paymentMethod === "voucher" ? "voucher" : "paynow",
      };

      // Add mobile payment details
      if (paymentMethod === "mobile") {
        body.phone = normalizePhone(phoneNumber);
        body.provider = mobileProvider;
      }

      const res = await fetch("/api/payments/create/payment/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },

    onSuccess: (data) => {
      if (paymentMethod === "voucher" && data.status === "paid_with_voucher") {
        toast({ title: "Paid with Voucher", description: "Your voucher covered the order." });
        queryClient.invalidateQueries({ queryKey: [`/api/orders/order/${orderId}`] });
        setTimeout(() => setLocation("/home"), 1000);
        return;
      }

      if (data.paynow_url) {
        toast({ title: "Opening PayNow...", description: "Complete payment in the new tab." });
        window.open(data.paynow_url, "_blank");
        return;
      }

      if (data.status === "paid" || data.status === "Payment Successful") {
        toast({ title: "Payment Successful", description: "Redirecting..." });
        setTimeout(() => setLocation("/home"), 1500);
        return;
      }

      toast({ title: "Payment Failed", description: "Unexpected response.", variant: "destructive" });
    },

    onError: (err: any) => {
      toast({ title: "Payment Failed", description: err.message || "Try again.", variant: "destructive" });
    },
  });

  // --- Voucher Deposit ---
  const voucherDepositMutation = useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/payments/deposit-voucher/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: depositAmount }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Deposit Started", description: "Complete payment in the new tab." });
      window.open(data.paynow_url, "_blank");
    },
  });

  // --- Poll mobile payment status ---
  useEffect(() => {
    let interval: any;
    let attempts = 0;

    if (paymentMethod === "mobile" && paymentMutation.isSuccess) {
      interval = setInterval(async () => {
        attempts++;
        if (attempts > 24) {
          clearInterval(interval);
          toast({ title: "Payment Timeout", description: "Please try again." });
          return;
        }

        const token = localStorage.getItem("token");
        // ✅ Ensure this endpoint matches backend: /api/payments/paynow/status/<reference>/
        const res = await fetch(`/api/payments/paynow/status/${orderId}/`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const data = await res.json();
          if (data.status === "paid" || data.status === "Payment Successful") {
            toast({ title: "Payment Confirmed", description: "Redirecting..." });
            clearInterval(interval);
            setTimeout(() => setLocation("/home"), 1500);
          }
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [paymentMutation.isSuccess, paymentMethod, orderId, toast, setLocation]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOrder) {
      toast({ title: "Order Not Found", variant: "destructive" });
      return;
    }

    if (paymentMethod === "mobile" && (!phoneNumber || !mobileProvider)) {
      toast({ title: "Missing Info", description: "Please fill phone and provider." });
      return;
    }

    paymentMutation.mutate();
  };

  if (isLoading) return <div>Loading order...</div>;
  if (!currentOrder) return <div>Order not found</div>;

  const isProcessing = paymentMutation.isPending || voucherDepositMutation.isPending;
  
  // Calculate subtotal from each_item_price if available, otherwise from items
  const itemsSubtotal = (currentOrder.each_item_price && currentOrder.each_item_price.length > 0)
    ? currentOrder.each_item_price.reduce((sum: number, item: any) => {
        return sum + (parseFloat(item.price || '0') * (item.quantity || 1));
      }, 0)
    : currentOrder.items.reduce((sum, item) => {
        return sum + (parseFloat(item.price) * item.quantity);
      }, 0);
  const deliveryFee = Number(currentOrder.delivery_fee) || 0;
  const tip = parseFloat(currentOrder.tip) || 0;
  const totalAmount = itemsSubtotal + deliveryFee + tip;

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setLocation("/customer")}
            className="p-1"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <CardTitle>Complete Your Payment</CardTitle>
        </div>
        <Badge variant="outline">Order #{currentOrder.id.slice(-8)}</Badge>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <h2 className="font-semibold">Your Order:</h2>
          {currentOrder.each_item_price && currentOrder.each_item_price.length > 0 ? (
            <ul className="list-disc pl-5">
              {currentOrder.each_item_price.map((item: any, idx: number) => (
                <li key={idx}>
                  {item.name || 'Item'} x {item.quantity || 1} - ${(parseFloat(item.price || '0') * (item.quantity || 1)).toFixed(2)}
                </li>
              ))}
            </ul>
          ) : currentOrder.items.length === 0 ? (
            <p>No items added yet.</p>
          ) : (
            <ul className="list-disc pl-5">
              {currentOrder.items.map((item, idx) => (
                <li key={idx}>
                  {item.name} x {item.quantity} - ${(parseFloat(item.price) * item.quantity).toFixed(2)}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-sm text-muted-foreground">Subtotal: ${itemsSubtotal.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground">
            Delivery Fee: ${deliveryFee.toFixed(2)} 
            <span className="text-xs text-gray-400 ml-1">(${DELIVERY_RATE_PER_KM.toFixed(2)}/km)</span>
          </p>
          {tip > 0 && <p className="text-sm text-muted-foreground">Tip: ${tip.toFixed(2)}</p>}
          <p className="mt-1 font-semibold text-lg">Total: ${totalAmount.toFixed(2)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Select
            value={paymentMethod}
            onValueChange={(value) => setPaymentMethod(value as "web" | "mobile" | "voucher")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="web">PayNow Web</SelectItem>
              <SelectItem value="mobile">PayNow Mobile</SelectItem>
              <SelectItem value="voucher">Feast Voucher</SelectItem>
            </SelectContent>
          </Select>

          {paymentMethod === "mobile" && (
            <MobilePaymentFields
              phoneNumber={phoneNumber}
              setPhoneNumber={setPhoneNumber}
              mobileProvider={mobileProvider}
              setMobileProvider={setMobileProvider}
            />
          )}

          {paymentMethod === "voucher" && (
            <div className="border-t pt-3">
              <p className="text-sm text-muted-foreground mb-2">
                Your Feast Voucher Balance: $
                {voucherBalance !== null ? voucherBalance.toFixed(2) : "Loading..."}
              </p>
              <p className="text-sm text-muted-foreground mb-2">
                Use your voucher balance to pay. To deposit funds, enter an amount:
              </p>
              <Input
                type="number"
                min="1"
                placeholder="Enter amount to deposit"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
              />
              <Button
                type="button"
                className="w-full mt-2"
                onClick={() => voucherDepositMutation.mutate()}
                disabled={!depositAmount || voucherDepositMutation.isPending}
              >
                {voucherDepositMutation.isPending ? "Redirecting..." : "Deposit to Voucher"}
              </Button>
            </div>
          )}

          <Button type="submit" disabled={isProcessing} className="w-full">
            {isProcessing ? "Processing..." : `Pay $${totalAmount.toFixed(2)}`}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};
