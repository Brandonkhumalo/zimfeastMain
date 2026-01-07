import { Button } from "@/components/ui/button";
import { User } from "./types";

interface HeaderProps {
  user?: User;
}

export function Header({ user }: HeaderProps) {
  return (
    <header className="bg-primary text-primary-foreground">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Welcome to ZimFeast</h1>
          <p className="text-primary-foreground/80">
            Hello, {user?.firstName || "User"}! Choose your portal below.
          </p>
        </div>
        <Button
          onClick={async () => {
            const token = localStorage.getItem("token");
            if (!token) {
              window.location.href = "/login";
              return;
            }
            try {
              await fetch("/api/accounts/logout/", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`,
                },
              });
              localStorage.removeItem("token");
              window.location.href = "/login";
            } catch (err) {
              localStorage.removeItem("token");
              window.location.href = "/login";
            }
          }}
          variant="outline"
          className="border-white/20 text-primary-foreground hover:bg-white/10"
        >
          <i className="fas fa-sign-out-alt mr-2"></i>
          Logout
        </Button>
      </div>
    </header>
  );
}
