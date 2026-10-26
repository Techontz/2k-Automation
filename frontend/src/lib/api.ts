/**
 * Browser-side API client. All calls go through the Next.js route handler at
 * /api/backend/*, which attaches the httpOnly session cookie as a bearer token
 * and the active workspace header. Tokens never touch client JavaScript.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }

  /** Laravel validation errors keyed by field. */
  get errors(): Record<string, string[]> {
    return (this.data.errors as Record<string, string[]>) ?? {};
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/backend/${path.replace(/^\//, "")}`, {
    method,
    headers: { Accept: "application/json", ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (response.status === 401 && typeof window !== "undefined" && !path.startsWith("auth/")) {
    window.location.replace(new URL(`/login?next=${encodeURIComponent(window.location.pathname)}`, window.location.origin));
  }

  const text = await response.text();
  const data = text ? safeJson(text) : {};

  if (!response.ok) {
    const message =
      (data as { message?: string }).message ||
      firstValidationError(data) ||
      `Request failed (${response.status})`;
    throw new ApiError(message, response.status, data as Record<string, unknown>);
  }

  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function firstValidationError(data: unknown): string | undefined {
  const errors = (data as { errors?: Record<string, string[]> }).errors;
  return errors ? Object.values(errors)[0]?.[0] : undefined;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body: unknown = {}) => request<T>("POST", path, body),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

/** SWR fetcher: keys are API paths such as "automations?status=active". */
export const fetcher = <T>(path: string) => api.get<T>(path);

/** Build a query string, skipping empty values. */
export function qs(params: Record<string, string | number | boolean | null | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  });
  const value = search.toString();
  return value ? `?${value}` : "";
}
