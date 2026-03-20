import { apiRequest } from "@/lib/apiRequest";

export async function getDriverStatus(): Promise<{ is_online: boolean }> {
  return apiRequest<{ is_online: boolean }>("/api/drivers/status/");
}

export async function toggleDriverStatus(): Promise<{ is_online: boolean }> {
  return apiRequest<{ is_online: boolean }>("/api/drivers/status/toggle/", "POST");
}

export async function getActiveDriverOrders(): Promise<
  { id: string; status: string; fee: number; location: string | null }[]> {
  return apiRequest("/api/drivers/active/orders/");
}

export async function getDriverDailyFinances(): Promise<{
  today_deliveries: number;
  today_earnings: number;
  average_rating: number;
  hours_online: number;
}> {
  return apiRequest("/api/drivers/daily/finances/");
}

export async function getDriverOrderHistory(cursor?: string) {
  const url = cursor
    ? `/api/drivers/orders/history/?cursor=${encodeURIComponent(cursor)}`
    : `/api/drivers/orders/history/`;

  return apiRequest<{
    results: {
      id: string;
      status: string;
      fee: number;
      location: string | null;
      order_date: string;
    }[];
    next: string | null;
    previous: string | null;
  }>(url);
}
