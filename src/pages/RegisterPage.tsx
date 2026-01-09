import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, Link } from "wouter";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface RegisterResponse {
  accessToken: string;
}

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [role, setRole] = useState<"customer" | "restaurant" | "driver">(
    "customer"
  );

  const registerMutation = useMutation({
    mutationFn: async (): Promise<RegisterResponse> => {
      const res = await fetch("/api/accounts/register/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
          phone_number: phoneNumber,
          role,
        }),
      });

      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(text);
      }

      return res.json();
    },

    onSuccess: async (data) => {
      localStorage.setItem("token", data.accessToken);
      await queryClient.invalidateQueries({
        queryKey: ["/api/accounts/profile/"],
      });

      if (role === "restaurant" || role === "driver") {
        setLocation("/business-hub");
      } else {
        setLocation("/home");
      }
    },

    onError: (err: any) =>
      alert(err.message || "Registration failed"),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0a0a] relative">
      {/* Optional background mesh */}
      <div className="hero-mesh absolute inset-0 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md">
        <div className="glass-dark p-10 rounded-[32px] shadow-2xl">
          <h1 className="text-3xl font-black text-center text-gradient">
            Create Account
          </h1>

          <p className="text-center text-zinc-500 dark:text-white/40 mt-2">
            Join the platform in seconds
          </p>

          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 mt-6"
          >
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              className="glass px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/10"
            />

            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              className="glass px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/10"
            />

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

            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+263 77 123 4567"
              className="glass px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/10"
            />

            <Select
              value={role}
              onValueChange={(val) =>
                setRole(val as "customer" | "restaurant" | "driver")
              }
            >
              <SelectTrigger className="glass px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/10">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="customer">Customer</SelectItem>
                <SelectItem value="restaurant">Restaurant</SelectItem>
                <SelectItem value="driver">Driver</SelectItem>
              </SelectContent>
            </Select>

            <button
              type="submit"
              disabled={registerMutation.isPending}
              className="orange-gradient py-4 rounded-2xl font-black text-white shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
            >
              {registerMutation.isPending
                ? "Creating account..."
                : "Register"}
            </button>
          </form>

          <div className="text-center mt-6">
            <span className="text-sm text-zinc-600 dark:text-white/40">
              Already have an account?{" "}
            </span>
            <Link
              href="/login"
              className="text-sm font-bold text-blue-600 dark:text-orange-400 hover:underline"
            >
              Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
