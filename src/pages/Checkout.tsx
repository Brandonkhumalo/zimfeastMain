import { useEffect } from "react";
import { CheckoutForm } from "./checkout-components/CheckoutForm";

export default function Checkout() {
  const urlParams = new URLSearchParams(window.location.search);
  // Hardcoded for testing
  const orderId = urlParams.get('orderId') || '6c7a9a9f-f18a-4574-a82a-f483e41ced7f';

  useEffect(() => {
    if (!orderId) window.location.href = '/home';
  }, [orderId]);

  if (!orderId) return <div>No order specified. Redirecting...</div>;

  return (
    <div className="min-h-screen bg-background py-16">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-center mb-4">Checkout</h1>
        <CheckoutForm orderId={orderId} />
      </div>
    </div>
  );
}
