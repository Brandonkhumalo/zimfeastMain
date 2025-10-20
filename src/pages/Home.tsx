import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useEffect } from "react";
import { Header } from "./home-components/Header";
import { PortalSelection } from "./home-components/PortalSelection";
import { BusinessHub } from "./home-components/BusinessHub";
import { apiRequest } from "@/hooks/useAuth";
import { User } from "./home-components/types";

export default function Home() {
  const [, setLocation] = useLocation();

  // Fetch user profile with JWT
  const { data: userProfile, isLoading, error } = useQuery<User>({
    queryKey: ["user-profile"],
    queryFn: () =>
      apiRequest<User>("/api/accounts/profile/"),
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Handle redirect in useEffect to avoid setState during render
  useEffect(() => {
    if (error) {
      setLocation("/login");
    }
  }, [error, setLocation]);

  if (isLoading) return <div>Loading...</div>;

  if (error) {
    return null;
  }

  // Handle portal navigation with role check
  const handlePortalNavigation = (portal: string) => {
    if (
      portal === userProfile?.role ||
      userProfile?.role === "admin"
    ) {
      setLocation(`/${portal}`);
    } else {
      setLocation("/404");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header user={userProfile} />
      <PortalSelection
        user={userProfile}
        onNavigate={handlePortalNavigation}
      />
      <BusinessHub />
    </div>
  );
}
