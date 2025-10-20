import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { apiRequest, User } from "@/hooks/useAuth";
import { Link } from "wouter";

interface LoginResponse {
  accessToken: string;
}

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (): Promise<LoginResponse> => {
      const res = await fetch("http://127.0.0.1:8000/api/accounts/login/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(text);
      }
      return res.json();
    },
    onSuccess: async (data) => {
      // 1️⃣ Save token
      localStorage.setItem("token", data.accessToken);

      try {
        // 2️⃣ Fetch the real profile with the new token
        const profile = await apiRequest<User>("http://127.0.0.1:8000/api/accounts/profile/");

        // 3️⃣ Populate React Query immediately
        queryClient.setQueryData<User>(["/api/accounts/profile/"], profile);

        // 4️⃣ Redirect to home
        setLocation("/home");
      } catch (err: any) {
        // If profile fetch fails, clear token and show error
        localStorage.removeItem("token");
        alert("Failed to fetch user profile: " + err.message);
      }
    },
    onError: (err: any) => alert(err.message || "Login failed"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold text-gray-800">Login</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
            />
            <Input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
            <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
              {loginMutation.isPending ? "Logging in..." : "Login"}
            </Button>
            <div className="text-center mt-4">
              <span className="text-sm text-gray-600">
                  Don't have an account?{" "}
              </span>
              <Link href="/register" className="text-sm text-blue-600 hover:underline">
                  Register
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
