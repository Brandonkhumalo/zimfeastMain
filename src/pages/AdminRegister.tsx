import { useState } from "react";
import { useLocation } from "wouter";

export default function AdminRegister() {
  const [, setLocation] = useLocation();
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const adminToken = localStorage.getItem("admin_token");
      if (adminToken) {
        headers["Authorization"] = `Bearer ${adminToken}`;
      }

      const res = await fetch("/api/accounts/admin/register/", {
        method: "POST",
        headers,
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed");
        return;
      }

      // If no admin was logged in (bootstrap), store the new token
      if (!adminToken) {
        localStorage.setItem("admin_token", data.accessToken);
      }

      setSuccess("Admin user created successfully!");
      setForm({ email: "", password: "", first_name: "", last_name: "" });

      setTimeout(() => {
        if (!adminToken) {
          setLocation("/zimfeast/admin/dashboard");
        }
      }, 1500);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950">
      <div className="w-full max-w-md p-10 rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black text-white">Register Admin</h1>
          <p className="text-zinc-500 mt-1 text-sm">Create a new admin account</p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1 block">First Name</label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none transition"
                placeholder="John"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400 mb-1 block">Last Name</label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none transition"
                placeholder="Doe"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1 block">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none transition"
              placeholder="admin@zimfeast.com"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400 mb-1 block">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-orange-500 focus:outline-none transition"
              placeholder="Create a strong password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 py-3 rounded-lg bg-orange-600 hover:bg-orange-500 text-white font-bold transition disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Admin Account"}
          </button>
        </form>

        <div className="text-center mt-6">
          <button
            onClick={() => setLocation("/zimfeast/admin/login")}
            className="text-sm text-orange-400 hover:underline"
          >
            Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}
