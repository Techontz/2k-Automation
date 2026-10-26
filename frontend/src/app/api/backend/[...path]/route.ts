import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, SESSION_COOKIE, WORKSPACE_COOKIE } from "@/lib/server";

/**
 * Backend-for-frontend proxy: forwards /api/backend/* to Laravel /api/v1/*
 * with the session token from the httpOnly cookie.
 */
async function forward(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const workspace = store.get(WORKSPACE_COOKIE)?.value;

  const headers = new Headers({ Accept: request.headers.get("accept") ?? "application/json" });
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (workspace) headers.set("X-Workspace-Id", workspace);
  headers.set("X-Forwarded-For", request.headers.get("x-forwarded-for") ?? "");

  const url = `${BACKEND_URL}/api/v1/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const hasBody = !["GET", "HEAD"].includes(request.method);

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method: request.method,
      headers,
      body: hasBody ? await request.text() : undefined,
      cache: "no-store",
      redirect: "manual",
    });
  } catch {
    return NextResponse.json(
      { message: "Cannot reach the 2K Automation API. Is the Laravel server running?", code: "backend_unreachable" },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();
  ["content-type", "content-disposition", "retry-after"].forEach((name) => {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  });

  return new NextResponse(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
