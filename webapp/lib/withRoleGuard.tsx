import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  allowedRoles: Array<"customer" | "driver" | "restaurant" | "admin">;
}

export function withRoleGuard<T extends {}>(
  WrappedComponent: React.FC<T>,
  allowedRoles: Props["allowedRoles"]
) {
  return function GuardedComponent(props: T) {
    const { user, isLoading, isAuthenticated } = useAuth();
    const [unauthorized, setUnauthorized] = useState(false);

    useEffect(() => {
      if (!isLoading && isAuthenticated && user && !allowedRoles.includes(user.role)) {
        setUnauthorized(true);
      }
    }, [isLoading, isAuthenticated, user]);

    if (isLoading) return <div>Loading...</div>;

    if (!isAuthenticated) {
      return <div className="p-4 text-red-600 font-bold">Unauthorized: Please log in</div>;
    }

    if (unauthorized) {
      return <div className="p-4 text-red-600 font-bold">Unauthorized: You cannot access this portal</div>;
    }

    return <WrappedComponent {...props} />;
  };
}
