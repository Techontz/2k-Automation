import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { BACKEND_URL, SESSION_COOKIE, WORKSPACE_COOKIE, sessionCookieOptions } from "@/lib/server";

/**
 * Session endpoints: login/register store the Sanctum token in an httpOnly
 * cookie; logout revokes it; workspace switches the active workspace cookie.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  const { action } = await params;
  const store = await cookies();

  if (action === "login" || action === "register") {
    const upstream = await fetch(`${BACKEND_URL}/api/v1/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Forwarded-For": request.headers.get("x-forwarded-for") ?? "" },
      body: await request.text(),
      cache: "no-store",
    }).catch(() => null);

    if (!upstream) {
      return NextResponse.json({ message: "Cannot reach the 2K Automation API." }, { status: 502 });
    }

    const data = await upstream.json();
    if (!upstream.ok) return NextResponse.json(data, { status: upstream.status });

    store.set(SESSION_COOKIE, data.token, sessionCookieOptions);
    if (data.user?.current_workspace_id) {
      store.set(WORKSPACE_COOKIE, String(data.user.current_workspace_id), { ...sessionCookieOptions, httpOnly: false });
    }

    return NextResponse.json({ user: data.user });
  }

  if (action === "logout") {
    const token = store.get(SESSION_COOKIE)?.value;
    if (token) {
      await fetch(`${BACKEND_URL}/api/v1/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      }).catch(() => null);
    }
    store.delete(SESSION_COOKIE);
    store.delete(WORKSPACE_COOKIE);
    return NextResponse.json({ ok: true });
  }

  if (action === "workspace") {
    const { workspace_id } = (await request.json()) as { workspace_id: number };
    const token = store.get(SESSION_COOKIE)?.value;
    const upstream = await fetch(`${BACKEND_URL}/api/v1/workspaces/${workspace_id}/switch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!upstream.ok) return NextResponse.json({ message: "Workspace not available." }, { status: upstream.status });
    store.set(WORKSPACE_COOKIE, String(workspace_id), { ...sessionCookieOptions, httpOnly: false });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ message: "Not found" }, { status: 404 });
}
