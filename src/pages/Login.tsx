import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, User } from "@/hooks/useAuth";

export default function Login() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const loginMutation = useMutation({
    mutationFn: async (): Promise<{ accessToken: string }> => {
      const res = await fetch("/api/accounts/login/", {
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
      localStorage.setItem("token", data.accessToken);

      try {
        const profile = await apiRequest<User>("/api/accounts/profile/");
        queryClient.setQueryData<User>(["/api/accounts/profile/"], profile);
        setLocation("/home");
      } catch (err: any) {
        localStorage.removeItem("token");
        alert("Failed to fetch user profile");
      }
    },

    onError: (err: any) => {
      alert(err.message || "Login failed");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a]">
      <div className="w-full max-w-md glass-dark p-10 rounded-[32px] shadow-2xl">
        <h1 className="text-3xl font-black text-center text-gradient">
          Welcome Back
        </h1>

        <p className="text-center text-zinc-500 dark:text-white/40 mt-2">
          Enter your credentials to continue
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-6">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="glass px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/10"
          />

          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="glass px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/10"
          />

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="orange-gradient py-4 rounded-2xl font-black text-white shadow-xl"
          >
            {loginMutation.isPending ? "Logging in..." : "Login"}
          </button>
        </form>

        {/* ✅ THIS NOW WORKS */}
        <div className="text-center mt-6">
          <span className="text-sm text-zinc-600 dark:text-white/40">
            Don’t have an account?{" "}
          </span>
          <button
            onClick={() => setLocation("/register")}
            className="text-sm font-bold text-blue-600 dark:text-orange-400 hover:underline"
          >
            Register
          </button>
        </div>
      </div>
    </div>
  );
}
