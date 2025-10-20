import { apiRequest } from "./apiRequest";

export async function getDriverStatus(): Promise<{ is_online: boolean }> {
  return apiRequest<{ is_online: boolean }>("GET", "/api/drivers/status/");
}

export async function toggleDriverStatus(): Promise<{ is_online: boolean }> {
  return apiRequest<{ is_online: boolean }>("PUT", "/api/drivers/status/toggle/");
}

export async function getActiveDriverOrders(): Promise<
  { id: string; status: string; fee: number; location: string | null }[]> {
  return apiRequest("GET", "/api/drivers/active/orders/");
}