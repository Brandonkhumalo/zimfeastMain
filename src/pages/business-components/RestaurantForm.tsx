import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  restaurantRegistrationSchema,
  RestaurantRegistration,
} from "./types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

import { useLocation } from "wouter";

// ✅ Tell TypeScript about window.google
declare global {
  interface Window {
    google: any;
  }
}

interface Cuisine {
  id: number;
  name: string;
}

export default function RestaurantForm() {
  const [role, setRole] = useState<"customer" | "restaurant" | "driver" | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cuisines, setCuisines] = useState<Cuisine[]>([]);

  const [, setLocation] = useLocation();

  const form = useForm<RestaurantRegistration>({
    resolver: zodResolver(restaurantRegistrationSchema),
    defaultValues: {
      cuisineType: undefined,
      latitude: "",
      longitude: "",
    },
  });

  // Load Google Maps script
  useEffect(() => {
    if (!window.google) {
      const script = document.createElement("script");
      script.src =
        "https://maps.googleapis.com/maps/api/js?key=AIzaSyB6rSsWSWLJhcA2pzFtt-Y1I2wx6UAdyD4&libraries=places";
      script.async = true;
      script.onload = () => console.log("✅ Google Maps script loaded");
      document.body.appendChild(script);
    }
  }, []);

  // Fetch user profile
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setRole(null);
      setLoading(false);
      return;
    }

    fetch("/api/accounts/profile/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        setRole(data.role);
      })
      .catch(() => setRole(null))
      .finally(() => setLoading(false));
  }, []);

  // Initialize Google Places Autocomplete
  useEffect(() => {
    if (role === "restaurant" && window.google) {
      const addressInput = document.getElementById("address-input") as HTMLInputElement;
      if (!addressInput) return;

      const autocomplete = new window.google.maps.places.Autocomplete(addressInput);
      autocomplete.addListener("place_changed", () => {
        const place = autocomplete.getPlace();
        if (!place.geometry) return;

        form.setValue("latitude", place.geometry.location.lat().toString());
        form.setValue("longitude", place.geometry.location.lng().toString());
        form.setValue("address", place.formatted_address || "");
      });
    }
  }, [role, form]);

  // Fetch cuisines from backend
  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch("/api/restaurants/get/cuisine/types/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data: Cuisine[]) => setCuisines(data))
      .catch(() => setCuisines([]));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (role !== "restaurant")
    return <p className="text-red-500 font-bold">Unauthorized - Restaurants</p>;

  const onSubmit: SubmitHandler<RestaurantRegistration> = async (data) => {
    setSubmitError(null);
    setSubmitting(true);

    const token = localStorage.getItem("token");
    if (!token) {
      setSubmitError("No token found. Please login again.");
      setSubmitting(false);
      return;
    }

    const payload = {
      name: data.name,
      description: data.description,
      full_address: data.address,
      lat: Number(data.latitude),
      lng: Number(data.longitude),
      phone_number: data.phone,
      minimum_order_price: Number(data.minimumOrder),
      est_delivery_time: Number(data.estimatedDeliveryTime),
      cuisines: data.cuisineType ? [Number(data.cuisineType)] : [],
    };

    try {
      const res = await fetch("/api/restaurants/create/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || "Failed to register restaurant");
      }

      // ✅ If successful, redirect to /home
      setLocation("/home");

      const result = await res.json();
      form.reset();
      alert("Restaurant registered successfully!");
    } catch (err: any) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
      <Input placeholder="Restaurant Name" {...form.register("name")} />
      <Input placeholder="Description" {...form.register("description")} />
      <Input id="address-input" placeholder="Address" {...form.register("address")} />
      <Input placeholder="Phone" {...form.register("phone")} />
      <Input
        placeholder="Minimum Order Amount ($ USD)"
        type="number"
        {...form.register("minimumOrder", { valueAsNumber: true })}
      />
      <Input
        placeholder="Estimated Delivery Time (minutes)"
        type="number"
        {...form.register("estimatedDeliveryTime", { valueAsNumber: true })}
      />

      {/* Cuisine Type */}
      <Select
        value={form.watch("cuisineType")}
        onValueChange={(val) => form.setValue("cuisineType", val as any)}
        disabled={cuisines.length === 0}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select Cuisine" />
        </SelectTrigger>
        <SelectContent className="max-h-60 overflow-y-auto">
          {cuisines.length === 0 ? (
            <SelectItem value="0">Cuisine Types unavailable</SelectItem>
          ) : (
            cuisines.map((cuisine) => (
              <SelectItem key={cuisine.id} value={cuisine.id.toString()}>
                {cuisine.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Hidden inputs so lat/long are submitted */}
      <input type="hidden" {...form.register("latitude")} />
      <input type="hidden" {...form.register("longitude")} />

      <Button type="submit" disabled={submitting}>
        {submitting ? "Registering..." : "Register Restaurant"}
      </Button>

      {submitError && <p className="text-red-500">{submitError}</p>}
    </form>
  );
}
1