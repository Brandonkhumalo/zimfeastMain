import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/apiRequest";

export { apiRequest };

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role: "admin" | "customer" | "driver" | "restaurant" | "admin";
}

// Auth hook
export function useAuth() {
  const token = localStorage.getItem("token");

  const { data, isLoading, error, refetch } = useQuery<User>({
    queryKey: ["/api/accounts/profile/"],
    queryFn: () => apiRequest<User>("/api/accounts/profile/"),
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
