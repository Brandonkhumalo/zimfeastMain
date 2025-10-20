import { useMutation } from "@tanstack/react-query";
import { RestaurantRegistration, DriverRegistration } from "./types";

async function postData<T>(url: string, data: T) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Request failed");
  }
  return res.json();
}

export function useRegisterRestaurant() {
  return useMutation({
    mutationFn: (data: RestaurantRegistration) =>
      postData("http://127.0.0.1:8000/api/restaurants/register", data),
  });
}

export function useRegisterDriver() {
  return useMutation({
    mutationFn: (data: DriverRegistration) =>
      postData("http://127.0.0.1:8000/api/drivers/register", data),
  });
}
