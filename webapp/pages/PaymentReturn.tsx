import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";

export default function PaymentReturn() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<"checking" | "success" | "failed">("checking");

  useEffect(() => {
    setStatus("success");
    const timer = setTimeout(() => {
      setLocation("/customer");
    }, 3000);
    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <CardTitle className="flex flex-col items-center gap-4">
            {status === "checking" ? (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-orange-500" />
                <span>Verifying Payment...</span>
              </>
            ) : status === "success" ? (
              <>
                <CheckCircle className="h-12 w-12 text-green-500" />
                <span className="text-green-700">Payment Successful!</span>
              </>
            ) : (
              <>
                <span className="text-red-600">Payment Issue</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            {status === "success" 
              ? "Your order has been placed. Redirecting you back..." 
              : "Please wait..."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
