export async function apiRequest<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  body?: any
): Promise<T> {
  const token = localStorage.getItem("token");
  const res = await fetch(`http://127.0.0.1:8000${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }

  return res.json();
}

export async function getDriverOrderHistory(cursor?: string) {
  const url = cursor
    ? `/api/drivers/orders/history/?cursor=${encodeURIComponent(cursor)}`
    : `/api/drivers/orders/history/`;

  const res = await apiRequest<{
    results: {
      id: string;
      status: string;
      fee: number;
      location: string | null;
      order_date: string;
    }[];
    next: string | null;
    previous: string | null;
  }>("GET", url);

  return res;
}