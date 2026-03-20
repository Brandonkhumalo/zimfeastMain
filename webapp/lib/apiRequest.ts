/**
 * Canonical API request function with JWT auth and automatic token refresh.
 * All API calls across the app should use this single function.
 *
 * When a request receives a 401 response the function will:
 *   1. Attempt to refresh the access token using the refresh token stored in
 *      localStorage (key: "refreshToken").
 *   2. If the refresh succeeds, store the new tokens and retry the original
 *      request exactly once.
 *   3. If the refresh fails (or there is no refresh token), clear all tokens
 *      from localStorage and redirect to /login.
 *
 * A mutex flag prevents multiple concurrent refresh attempts — any requests
 * that arrive while a refresh is in flight will wait for it to complete.
 */

// ── Refresh mutex ────────────────────────────────────────────────────────────
let isRefreshing = false;
// Queued callers that are waiting for the in-flight refresh to finish.
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeToRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function onRefreshComplete(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

// ── Token helpers ────────────────────────────────────────────────────────────
function getAccessToken(): string | null {
  return localStorage.getItem("token");
}

function getRefreshToken(): string | null {
  return localStorage.getItem("refreshToken");
}

function storeTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("token", accessToken);
  localStorage.setItem("refreshToken", refreshToken);
}

function clearTokensAndRedirect() {
  localStorage.removeItem("token");
  localStorage.removeItem("refreshToken");
  // Use window.location so it works outside of React Router context.
  window.location.href = "/login";
}

// ── Core refresh logic ───────────────────────────────────────────────────────
async function attemptTokenRefresh(): Promise<string> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  const res = await fetch("/api/accounts/refresh/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) {
    throw new Error("Refresh failed");
  }

  const data: { accessToken: string; refreshToken: string } = await res.json();
  storeTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
}

// ── Public API ───────────────────────────────────────────────────────────────
export async function apiRequest<T>(
  url: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE" = "GET",
  data?: any
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {};
  if (data) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  // ── Happy path ──────────────────────────────────────────────────
  if (res.ok) {
    return res.json();
  }

  // ── Not a 401 — throw immediately ──────────────────────────────
  if (res.status !== 401) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }

  // ── 401 — attempt token refresh ────────────────────────────────
  // If there is no refresh token at all, go straight to login.
  if (!getRefreshToken()) {
    clearTokensAndRedirect();
    throw new Error("401: Session expired");
  }

  // If a refresh is already in-flight, wait for it instead of firing another.
  if (isRefreshing) {
    const newToken = await new Promise<string>((resolve) => {
      subscribeToRefresh(resolve);
    });
    // Retry the original request with the fresh token.
    const retryHeaders: Record<string, string> = {};
    if (data) retryHeaders["Content-Type"] = "application/json";
    retryHeaders["Authorization"] = `Bearer ${newToken}`;

    const retryRes = await fetch(url, {
      method,
      headers: retryHeaders,
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!retryRes.ok) {
      const text = await retryRes.text();
      throw new Error(`${retryRes.status}: ${text}`);
    }
    return retryRes.json();
  }

  // We are the first caller to hit 401 — take responsibility for refreshing.
  isRefreshing = true;

  try {
    const newToken = await attemptTokenRefresh();
    isRefreshing = false;
    onRefreshComplete(newToken);

    // Retry the original request with the new token.
    const retryHeaders: Record<string, string> = {};
    if (data) retryHeaders["Content-Type"] = "application/json";
    retryHeaders["Authorization"] = `Bearer ${newToken}`;

    const retryRes = await fetch(url, {
      method,
      headers: retryHeaders,
      body: data ? JSON.stringify(data) : undefined,
    });
    if (!retryRes.ok) {
      const text = await retryRes.text();
      throw new Error(`${retryRes.status}: ${text}`);
    }
    return retryRes.json();
  } catch {
    // Refresh failed — clear everything and send user to login.
    isRefreshing = false;
    refreshSubscribers = [];
    clearTokensAndRedirect();
    throw new Error("401: Session expired — could not refresh token");
  }
}
