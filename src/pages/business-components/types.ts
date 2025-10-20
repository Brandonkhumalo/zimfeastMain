import { z } from "zod";

export const restaurantRegistrationSchema = z.object({
  name: z.string().min(2),
  description: z.string().min(10),
  cuisineType: z.string().min(1), // We'll pass as string (id)
  address: z.string().min(10),
  city: z.string().default("Harare"),
  phone: z.string().min(10),
  minimumOrder: z.number().min(0), // ✅ now number
  estimatedDeliveryTime: z.number().min(15).max(120), // ✅ number
  latitude: z.string(),
  longitude: z.string(),
  hasExternalMenu: z.boolean().default(false),
  menuApiEndpoint: z.string().optional(),
  menuApiKey: z.string().optional(),
  menuApiName: z.string().optional(),
  hasExternalOrderSystem: z.boolean().default(false),
  orderApiEndpoint: z.string().optional(),
  orderApiKey: z.string().optional(),
  orderApiName: z.string().optional(),
});

export const driverRegistrationSchema = z.object({
  vehicleType: z.enum(['motorcycle', 'car', 'bicycle']),
  vehicleModel: z.string().min(2, "Vehicle model is required"),
  vehicleNumber: z.string().min(3, "Vehicle number is required"),
  vehicleColor: z.string().min(3, "Vehicle color is required"),
  licenseNumber: z.string().min(8, "License number is required"),
  address: z.string().min(5, "Address is required"),
});

export type RestaurantRegistration = z.infer<typeof restaurantRegistrationSchema>;
export type DriverRegistration = z.infer<typeof driverRegistrationSchema>;
