import { apiRequest } from "./apiRequest";

export async function getDriverStatus(): Promise<{ is_online: boolean }> {
  return apiRequest<{ is_online: boolean }>("GET", "/api/drivers/status/");
}

export async function toggleDriverStatus(): Promise<{ is_online: boolean }> {
  return apiRequest<{ is_online: boolean }>("POST", "/api/drivers/status/toggle/");
}

export async function getActiveDriverOrders(): Promise<
  { id: string; status: string; fee: number; location: string | null }[]> {
  return apiRequest("GET", "/api/drivers/active/orders/");
}

export async function getDriverDailyFinances(): Promise<{
  today_deliveries: number;
  today_earnings: number;
  average_rating: number;
  hours_online: number;
}> {
  return apiRequest("GET", "/api/drivers/daily/finances/");
}

export async function getDriverOrderHistory(): Promise<any[]> {
  return apiRequest("GET", "/api/drivers/orders/history/");
}