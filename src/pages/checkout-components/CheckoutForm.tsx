import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  restaurant_names: string[];
  delivery_fee: number;
  status: string;
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
      const res = await fetch(`http://127.0.0.1:8000/api/orders/order/${orderId}/`, {
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
        const res = await fetch("http://127.0.0.1:8000/api/payments/feast/voucher/balance/", {
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

      const res = await fetch("http://127.0.0.1:8000/api/payments/create/payment/", {
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
        toast({ title: "Redirecting to PayNow...", description: "Please complete your payment." });
        window.location.href = data.paynow_url;
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
      const res = await fetch("http://127.0.0.1:8000/api/payments/deposit-voucher/", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: depositAmount }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Deposit Started", description: "Redirecting to PayNow..." });
      window.location.href = data.paynow_url;
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
        const res = await fetch(`http://127.0.0.1:8000/api/payments/paynow/status/${orderId}/`, {
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
  const totalAmount = parseFloat(currentOrder.total_fee) + (parseFloat(currentOrder.tip) || 0);

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Complete Your Payment</CardTitle>
        <Badge variant="outline">Order #{currentOrder.id.slice(-8)}</Badge>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <h2 className="font-semibold">Your Order:</h2>
          {currentOrder.items.length === 0 ? (
            <p>No items added yet.</p>
          ) : (
            <ul className="list-disc pl-5">
              {currentOrder.items.map((item, idx) => (
                <li key={idx}>
                  {item.name} x {item.quantity} - ${parseFloat(item.price).toFixed(2)}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2">Delivery Fee: ${currentOrder.delivery_fee.toFixed(2)}</p>
          <p className="mt-1 font-semibold">Total: ${totalAmount.toFixed(2)}</p>
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
