import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const cookieName = process.env.SESSION_COOKIE_NAME ?? "gawe_session";
  const incomingRequestId = request.headers.get("x-request-id")?.trim();
  const requestId = incomingRequestId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incomingRequestId)
    ? incomingRequestId
    : crypto.randomUUID();
  const token = request.headers.get("cookie")?.match(new RegExp(`${cookieName}=([^;]+)`))?.[1];
  if (token) {
    await fetch(`${process.env.API_BASE_URL ?? "http://localhost/api/v1"}/auth/logout`, {
      method: "POST",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "X-Request-Id": requestId },
    });
  }
  const response = NextResponse.json({ success: true });
  response.headers.set("X-Request-Id", requestId);
  response.cookies.delete(cookieName);
  return response;
}
