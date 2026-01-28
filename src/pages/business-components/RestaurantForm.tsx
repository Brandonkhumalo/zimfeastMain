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
import { Label } from "@/components/ui/label";
import LocationPicker from "@/components/ui/location-picker";

import { useLocation } from "wouter";

declare global {
  interface Window {
    google: any;
  }
}

const GOOGLE_MAPS_API_KEY = "AIzaSyB6rSsWSWLJhcA2pzFtt-Y1I2wx6UAdyD4";

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

  const handleLocationChange = (location: { lat: number; lng: number; address: string }) => {
    form.setValue("latitude", location.lat.toString());
    form.setValue("longitude", location.lng.toString());
    form.setValue("address", location.address);
  };

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
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Restaurant Name</Label>
          <Input 
            id="name" 
            placeholder="Enter restaurant name" 
            {...form.register("name")} 
            data-testid="input-restaurant-name"
          />
          {form.formState.errors.name && (
            <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Input 
            id="description" 
            placeholder="Describe your restaurant" 
            {...form.register("description")} 
            data-testid="input-restaurant-description"
          />
        </div>

        <div>
          <Label htmlFor="phone">Phone Number</Label>
          <Input 
            id="phone" 
            placeholder="+263..." 
            {...form.register("phone")} 
            data-testid="input-restaurant-phone"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="minimumOrder">Minimum Order (USD)</Label>
            <Input
              id="minimumOrder"
              placeholder="5.00"
              type="number"
              step="0.01"
              {...form.register("minimumOrder", { valueAsNumber: true })}
              data-testid="input-minimum-order"
            />
          </div>
          <div>
            <Label htmlFor="estimatedDeliveryTime">Delivery Time (min)</Label>
            <Input
              id="estimatedDeliveryTime"
              placeholder="30"
              type="number"
              {...form.register("estimatedDeliveryTime", { valueAsNumber: true })}
              data-testid="input-delivery-time"
            />
          </div>
        </div>

        <div>
          <Label>Cuisine Type</Label>
          <Select
            value={form.watch("cuisineType")}
            onValueChange={(val) => form.setValue("cuisineType", val as any)}
            disabled={cuisines.length === 0}
          >
            <SelectTrigger data-testid="select-cuisine-type">
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
        </div>
      </div>

      <div className="space-y-2">
        <Label>Restaurant Location</Label>
        <p className="text-sm text-muted-foreground">
          Search for your address or drag the marker to set your exact location
        </p>
        <LocationPicker
          onLocationChange={handleLocationChange}
          apiKey={GOOGLE_MAPS_API_KEY}
          height="350px"
        />
        {form.formState.errors.address && (
          <p className="text-sm text-destructive">{form.formState.errors.address.message}</p>
        )}
      </div>

      <input type="hidden" {...form.register("latitude")} />
      <input type="hidden" {...form.register("longitude")} />
      <input type="hidden" {...form.register("address")} />

      <Button type="submit" disabled={submitting} className="w-full" data-testid="button-register-restaurant">
        {submitting ? "Registering..." : "Register Restaurant"}
      </Button>

      {submitError && <p className="text-destructive text-center">{submitError}</p>}
    </form>
  );
}
1