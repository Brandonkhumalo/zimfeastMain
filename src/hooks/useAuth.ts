import { useQuery } from "@tanstack/react-query";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role: "admin" | "customer" | "driver" | "restaurant" | "admin";
}

// Helper to call API with JWT
export async function apiRequest<T>(
  url: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  data?: any
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }

  return res.json();
}

// Auth hook
export function useAuth() {
  const token = localStorage.getItem("token");

  const { data, isLoading, error, refetch } = useQuery<User>({
    queryKey: ["/api/accounts/profile/"],
    queryFn: () => apiRequest<User>("http://127.0.0.1:8000/api/accounts/profile/"),
    enabled: !!token, // only fetch if token exists
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    user: data,
    isAuthenticated: !!data,
    isLoading,
    error,
    refetch, // expose refetch for manual calls
  };
}
