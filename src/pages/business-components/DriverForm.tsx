import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { driverRegistrationSchema, DriverRegistration } from "./types";
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

export default function DriverForm() {
  const [role, setRole] = useState<"customer" | "restaurant" | "driver" | null>(null);
  const [loading, setLoading] = useState(true);
  const [licensePhoto, setLicensePhoto] = useState<File | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<File | null>(null);

  const [location, setLocation] = useLocation();

  const form = useForm<DriverRegistration>({
    resolver: zodResolver(driverRegistrationSchema),
  });

  // ✅ Check user role
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setRole(null);
      setLoading(false);
      return;
    }

    fetch("http://127.0.0.1:8000/api/accounts/profile/", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => setRole(data.role))
      .catch(() => setRole(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading...</p>;
  if (role !== "driver") return <p className="text-red-500 font-bold">Unauthorized - Drivers only</p>;

  const onSubmit = async (data: DriverRegistration) => {
    const token = localStorage.getItem("token");
    const formData = new FormData();

    const vehicleDetails = {
      type: data.vehicleType,
      model: data.vehicleModel,
      number: data.vehicleNumber,
      color: data.vehicleColor,
    };

    formData.append("license_number", data.licenseNumber);
    formData.append("vehicle_details", JSON.stringify(vehicleDetails));
    formData.append("address", data.address);

    if (licensePhoto) formData.append("license_photo", licensePhoto);
    if (vehiclePhoto) formData.append("vehicle_photo", vehiclePhoto);

    try {
      const res = await fetch("http://127.0.0.1:8000/api/drivers/profile/create/", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(JSON.stringify(errorData));
      }

      alert("Driver profile created successfully!");
      form.reset();

      // ✅ Redirect to /home
      setLocation("/home");

    } catch (err: any) {
      alert("Failed to register driver: " + err.message);
    }
  };

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6 p-4 max-w-md mx-auto bg-white shadow-md rounded-xl"
    >
      <h2 className="text-xl font-bold text-center">Driver Registration</h2>

      {/* Vehicle Details */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-700">Vehicle Details</h3>

        {/* Vehicle Type using Select */}
        <div>
          <label className="block font-medium text-gray-700 mb-1">Vehicle Type</label>
          <Select
            onValueChange={(value) => form.setValue("vehicleType", value as any)}
            defaultValue=""
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select vehicle type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="car">Car</SelectItem>
              <SelectItem value="motorcycle">Motorcycle</SelectItem>
              <SelectItem value="bicycle">Bicycle</SelectItem>
            </SelectContent>
          </Select>
          {form.formState.errors.vehicleType && (
            <p className="text-red-500 text-sm mt-1">
              {form.formState.errors.vehicleType.message}
            </p>
          )}
        </div>

        <Input placeholder="Vehicle Model (e.g. Toyota Corolla)" {...form.register("vehicleModel")} />
        <Input placeholder="Vehicle Number (e.g. ABC 1234)" {...form.register("vehicleNumber")} />
        <Input placeholder="Vehicle Color (e.g. White)" {...form.register("vehicleColor")} />
      </div>

      {/* License Info */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-700">Driver Details</h3>
        <Input placeholder="License Number" {...form.register("licenseNumber")} />
        <Input
          placeholder="Physical Address (e.g. 7 Martin Drive, Msasa, Harare, Zimbabwe)"
          {...form.register("address")}
        />
      </div>

      {/* Photo Uploads Side-by-Side */}
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col items-center">
          <label className="block font-medium text-gray-600 mb-1">License Photo</label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setLicensePhoto(e.target.files?.[0] || null)}
          />
          {licensePhoto && (
            <img
              src={URL.createObjectURL(licensePhoto)}
              alt="License Preview"
              className="mt-2 w-28 h-28 object-cover rounded-md border"
            />
          )}
        </div>

        <div className="flex flex-col items-center">
          <label className="block font-medium text-gray-600 mb-1">Vehicle Photo</label>
          <Input
            type="file"
            accept="image/*"
            onChange={(e) => setVehiclePhoto(e.target.files?.[0] || null)}
          />
          {vehiclePhoto && (
            <img
              src={URL.createObjectURL(vehiclePhoto)}
              alt="Vehicle Preview"
              className="mt-2 w-28 h-28 object-cover rounded-md border"
            />
          )}
        </div>
      </div>

      <Button type="submit" className="w-full">
        Register Driver
      </Button>
    </form>
  );
}
