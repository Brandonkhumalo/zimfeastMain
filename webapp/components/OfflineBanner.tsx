import { useState, useEffect } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export default function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const [showReconnected, setShowReconnected] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true);
    } else if (wasOffline) {
      setShowReconnected(true);
      const timer = setTimeout(() => {
        setShowReconnected(false);
        setWasOffline(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] text-center text-sm font-medium py-2 px-4 transition-all duration-300 ${
        isOnline
          ? "bg-green-500 text-white"
          : "bg-orange-500 text-white"
      }`}
    >
      {isOnline ? (
        <span>Back online!</span>
      ) : (
        <span>
          <i className="fas fa-wifi-slash mr-2"></i>
          You are offline. Some features may be unavailable.
        </span>
      )}
    </div>
  );
}
