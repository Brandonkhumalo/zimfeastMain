import { useState, useEffect, useCallback, useRef } from "react";
import PageHeader from "./components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Activity,
  Server,
  Database,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Cpu,
  HardDrive,
  Wifi,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ── Types ────────────────────────────────────────────────────────────────────

interface ServiceHealth {
  name: string;
  port: number;
  url: string;
  status: "healthy" | "down" | "slow";
  responseTime: number | null;
  lastChecked: Date | null;
  error?: string;
}

interface ServiceConfig {
  name: string;
  port: number;
  url: string;
}

// ── Service definitions ──────────────────────────────────────────────────────

const SERVICES: ServiceConfig[] = [
  { name: "Auth Service",       port: 8001, url: "/api/accounts/health/" },
  { name: "Restaurant Service", port: 8002, url: "/api/restaurants/health/" },
  { name: "Order Service",      port: 8003, url: "/api/orders/health/" },
  { name: "Driver Service",     port: 8004, url: "/api/drivers/health/" },
  { name: "Payment Service",    port: 8005, url: "/api/payments/health/" },
  { name: "Realtime Service",   port: 3001, url: "" }, // External — skip health check
];

const POLL_INTERVAL_MS = 15_000;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStatusColor(status: "healthy" | "down" | "slow") {
  switch (status) {
    case "healthy":
      return { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-700", dot: "bg-emerald-500" };
    case "slow":
      return { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-500" };
    case "down":
      return { bg: "bg-red-50", border: "border-red-200", text: "text-red-700", dot: "bg-red-500" };
  }
}

function getStatusIcon(status: "healthy" | "down" | "slow") {
  switch (status) {
    case "healthy":
      return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    case "slow":
      return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    case "down":
      return <XCircle className="h-5 w-5 text-red-500" />;
  }
}

function formatTime(date: Date | null): string {
  if (!date) return "--";
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function AdminSystemPage() {
  const [services, setServices] = useState<ServiceHealth[]>([]);
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalChecksToday, setTotalChecksToday] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Check the health of a single service */
  const checkServiceHealth = useCallback(async (config: ServiceConfig): Promise<ServiceHealth> => {
    // Realtime service is on a different host — mark as "External" without checking
    if (!config.url) {
      return {
        name: config.name,
        port: config.port,
        url: "",
        status: "healthy",
        responseTime: null,
        lastChecked: new Date(),
        error: "External",
      };
    }

    const startTime = performance.now();
    try {
      const controller = new AbortController();
      // Timeout individual health checks after 5 seconds
      const timeout = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(config.url, {
        method: "GET",
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const responseTime = Math.round(performance.now() - startTime);
      const isHealthy = res.ok;

      return {
        name: config.name,
        port: config.port,
        url: config.url,
        status: !isHealthy ? "down" : responseTime > 2000 ? "down" : responseTime > 500 ? "slow" : "healthy",
        responseTime,
        lastChecked: new Date(),
      };
    } catch (err) {
      const responseTime = Math.round(performance.now() - startTime);
      return {
        name: config.name,
        port: config.port,
        url: config.url,
        status: "down",
        responseTime: responseTime > 0 ? responseTime : null,
        lastChecked: new Date(),
        error: err instanceof Error ? err.message : "Connection failed",
      };
    }
  }, []);

  /** Poll all services using Promise.allSettled so one failure doesn't block others */
  const pollAllServices = useCallback(async () => {
    setIsRefreshing(true);

    const results = await Promise.allSettled(
      SERVICES.map((config) => checkServiceHealth(config))
    );

    const healthResults: ServiceHealth[] = results.map((result, index) => {
      if (result.status === "fulfilled") {
        return result.value;
      }
      // If the promise itself rejected (shouldn't happen with our try/catch, but just in case)
      return {
        name: SERVICES[index].name,
        port: SERVICES[index].port,
        url: SERVICES[index].url,
        status: "down" as const,
        responseTime: null,
        lastChecked: new Date(),
        error: "Health check failed",
      };
    });

    setServices(healthResults);
    setTotalChecksToday((prev) => prev + 1);
    setIsFirstLoad(false);
    setIsRefreshing(false);
  }, [checkServiceHealth]);

  // Start polling on mount, cleanup on unmount
  useEffect(() => {
    pollAllServices();

    intervalRef.current = setInterval(pollAllServices, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [pollAllServices]);

  // Counts
  const healthyCount = services.filter((s) => s.status === "healthy").length;
  const slowCount = services.filter((s) => s.status === "slow").length;
  const downCount = services.filter((s) => s.status === "down").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Health"
        description="Monitor service status, health checks, and platform infrastructure."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={pollAllServices}
            disabled={isRefreshing}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {/* ── Summary Badges ── */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge
          variant="outline"
          className="border-emerald-200 text-emerald-700 bg-emerald-50 px-3 py-1"
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          {healthyCount} Healthy
        </Badge>
        {slowCount > 0 && (
          <Badge
            variant="outline"
            className="border-amber-200 text-amber-700 bg-amber-50 px-3 py-1"
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            {slowCount} Slow
          </Badge>
        )}
        {downCount > 0 && (
          <Badge
            variant="outline"
            className="border-red-200 text-red-700 bg-red-50 px-3 py-1"
          >
            <XCircle className="h-3.5 w-3.5 mr-1.5" />
            {downCount} Down
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          Auto-refreshes every 15 seconds
        </span>
      </div>

      {/* ── Service Status Grid ── */}
      {isFirstLoad ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="rounded-xl">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-5 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-20" />
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-16" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => {
            const colors = getStatusColor(service.status);
            return (
              <Card
                key={service.name}
                className={cn(
                  "rounded-xl transition-all hover:shadow-md",
                  colors.border,
                  "border"
                )}
              >
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Header: name + status icon */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Server className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold text-sm">{service.name}</h3>
                      </div>
                      {getStatusIcon(service.status)}
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full animate-pulse",
                          colors.dot
                        )}
                      />
                      <span className={cn("text-sm font-medium capitalize", colors.text)}>
                        {service.status}
                      </span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        Port {service.port}
                      </Badge>
                    </div>

                    {/* Response time + Last checked */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-3">
                      <div className="flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        <span>
                          {service.responseTime !== null
                            ? `${service.responseTime}ms`
                            : "N/A"}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{formatTime(service.lastChecked)}</span>
                      </div>
                    </div>

                    {/* Error or info message */}
                    {service.error && service.error !== "External" && (
                      <p className="text-xs text-red-600 bg-red-50 rounded-md px-2 py-1.5">
                        {service.error}
                      </p>
                    )}
                    {service.error === "External" && (
                      <p className="text-xs text-blue-600 bg-blue-50 rounded-md px-2 py-1.5">
                        External service — health check skipped
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── System Info ── */}
      <Card className="rounded-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Cpu className="h-5 w-5 text-orange-500" />
            System Information
          </CardTitle>
          <CardDescription>
            Platform infrastructure and configuration overview.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-blue-50 p-2.5">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Platform Version</p>
                <p className="text-sm font-semibold">1.0.0</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-purple-50 p-2.5">
                <Cpu className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Environment</p>
                <p className="text-sm font-semibold">
                  {import.meta.env.VITE_ENVIRONMENT || "Development"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-orange-50 p-2.5">
                <Server className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Services</p>
                <p className="text-sm font-semibold">6 Microservices</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-emerald-50 p-2.5">
                <Database className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Database</p>
                <p className="text-sm font-semibold">PostgreSQL 16</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-red-50 p-2.5">
                <HardDrive className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cache</p>
                <p className="text-sm font-semibold">Redis 7</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="rounded-lg bg-amber-50 p-2.5">
                <Wifi className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Uptime Checks Today</p>
                <p className="text-sm font-semibold">{totalChecksToday}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
