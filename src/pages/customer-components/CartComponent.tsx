import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { CartItem } from "./types";

// Add these for Google Places Autocomplete
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";
import useOnclickOutside from "react-cool-onclickoutside";

interface CartComponentProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  setItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  currency: string;
  userLocation: { lat: number; lng: number } | null;
}

export default function CartComponent({
  isOpen,
  onClose,
  items,
  setItems,
  currency,
  userLocation,
}: CartComponentProps) {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);

  const [method, setMethod] = useState<"delivery" | "collection">("collection");
  const [deliveryCoords, setDeliveryCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [tipAmount, setTipAmount] = useState<string>("");

  // Initialize Google Places Autocomplete
  const {
    ready,
    value,
    setValue,
    suggestions: { status, data },
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      /* optional: bounds, location bias */
    },
    debounce: 300,
  });

  const ref = useOnclickOutside(() => {
    clearSuggestions();
  });

  if (!isOpen) return null;

  const handleCheckout = async () => {
    if (items.length === 0) return;
    if (method === "delivery" && !deliveryCoords) {
      alert("Please select a delivery address");
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      if (!token) {
        alert("You must be logged in to place an order");
        return;
      }

      const firstItem = items[0];
      if (!firstItem.restaurantId || !firstItem.restaurantLat || !firstItem.restaurantLng) {
        alert("Invalid restaurant data in cart. Please try again.");
        return;
      }

      const payload = {
        restaurant: firstItem.restaurantId,
        method,
        restaurant_lat: firstItem.restaurantLat,
        restaurant_lng: firstItem.restaurantLng,
        total_fee: items.reduce((acc, item) => acc + item.price * item.quantity, 0),
        tip: method === "delivery" ? (parseFloat(tipAmount) || 0) : 0,
        items: items.map((item) => ({
          menu_item_id: item.id,
          quantity: item.quantity,
          price: item.price,
        })),
        delivery_lat: method === "delivery" ? deliveryCoords?.lat : null,
        delivery_lng: method === "delivery" ? deliveryCoords?.lng : null,
      };

      const res = await fetch("/api/orders/create/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }

      const data = await res.json();
      setItems([]);
      localStorage.removeItem("zimfeast_cart");
      setLocation(`/checkout?orderId=${data.order.id}`);
      onClose();
    } catch (err: any) {
      console.error("Checkout failed:", err.message);
      alert("Failed to place order: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectAddress = async (description: string) => {
    setValue(description, false);
    clearSuggestions();
    try {
      const results = await getGeocode({ address: description });
      const { lat, lng } = await getLatLng(results[0]);
      setDeliveryCoords({ lat, lng });
    } catch (error) {
      console.error("Error fetching geocode: ", error);
    }
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    if (quantity === 0) {
      setItems((prev) => prev.filter((item) => item.id !== id));
    } else {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, quantity } : item))
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="bg-white dark:bg-gray-900 w-96 h-full p-6 overflow-y-auto relative shadow-xl">
        <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Your Cart</h2>

        {items.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">Your cart is empty</p>
        ) : (
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                  <p className="text-sm text-orange-600 dark:text-orange-400">
                    {currency} {(item.price * item.quantity).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-300 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
                    onClick={() =>
                      handleQuantityChange(item.id, item.quantity - 1)
                    }
                  >
                    -
                  </Button>
                  <span className="text-gray-900 dark:text-white">{item.quantity}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-gray-300 dark:border-gray-600 dark:text-white dark:hover:bg-gray-700"
                    onClick={() =>
                      handleQuantityChange(item.id, item.quantity + 1)
                    }
                  >
                    +
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Delivery / Collection Section */}
        <div className="mt-6">
          <p className="font-medium mb-2 text-gray-900 dark:text-white">Choose Method:</p>
          <div className="flex gap-4 mb-2">
            <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="radio"
                value="delivery"
                checked={method === "delivery"}
                onChange={() => setMethod("delivery")}
                className="accent-orange-500"
              />
              Delivery
            </label>
            <label className="flex items-center gap-2 text-gray-700 dark:text-gray-300 cursor-pointer">
              <input
                type="radio"
                value="collection"
                checked={method === "collection"}
                onChange={() => setMethod("collection")}
                className="accent-orange-500"
              />
              Collection
            </label>
          </div>

          {method === "delivery" && (
            <div ref={ref} className="mt-2">
              <input
                type="text"
                placeholder="Enter delivery address"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={!ready}
                className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded mb-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
              {status === "OK" && (
                <ul className="border border-gray-300 dark:border-gray-600 rounded max-h-40 overflow-y-auto bg-white dark:bg-gray-800">
                  {data.map(({ place_id, description }) => (
                    <li
                      key={place_id}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer text-gray-900 dark:text-white"
                      onClick={() => handleSelectAddress(description)}
                    >
                      {description}
                    </li>
                  ))}
                </ul>
              )}

              {deliveryCoords && (
                <div className="border border-gray-300 dark:border-gray-600 h-40 w-full mt-2 rounded overflow-hidden">
                  <iframe
                    width="100%"
                    height="100%"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={`https://www.google.com/maps?q=${deliveryCoords.lat},${deliveryCoords.lng}&hl=es;z=14&output=embed`}
                  ></iframe>
                </div>
              )}

              <div className="mt-3">
                <label className="text-sm font-medium mb-1 block text-gray-700 dark:text-gray-300">Add a tip for your driver (optional)</label>
                <input
                  type="number"
                  min="0"
                  step="0.50"
                  placeholder="0.00"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={handleCheckout}
          className="mt-6 w-full"
          disabled={items.length === 0 || loading}
        >
          {loading ? "Placing order..." : "Proceed to Checkout"}
        </Button>

        <Button
          onClick={onClose}
          variant="ghost"
          className="absolute top-4 right-4 text-lg text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ✕
        </Button>
      </div>
    </div>
  );
}
