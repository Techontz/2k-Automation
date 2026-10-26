import "server-only";

export const SESSION_COOKIE = "tk_session";
export const WORKSPACE_COOKIE = "tk_workspace";

/** Laravel API origin, server-side only. */
export const BACKEND_URL = (process.env.BACKEND_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};
