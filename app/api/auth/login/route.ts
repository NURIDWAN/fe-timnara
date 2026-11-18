import { NextResponse } from "next/server";

type JsonBody = Record<string, unknown>;

function getRequestId(request: Request): string {
  const incoming = request.headers.get("x-request-id")?.trim();
  if (incoming && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incoming)) return incoming;
  return crypto.randomUUID();
}

async function readJson(request: Request): Promise<JsonBody | null> {
  try {
    return (await request.json()) as JsonBody;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  const payload = await readJson(request);
  if (payload === null || typeof payload.username !== "string" || typeof payload.password !== "string") {
    return NextResponse.json(
      { success: false, message: "Format login tidak valid.", data: null, meta: { request_id: requestId }, errors: null },
      { status: 400 },
    );
  }

  const baseUrl = process.env.API_BASE_URL ?? "http://localhost/api/v1";
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", "X-Request-Id": requestId },
      body: JSON.stringify({
        ...payload,
        device: {
          ...((payload.device as Record<string, unknown> | undefined) ?? {}),
          platform: "web",
        },
      }),
    });
  } catch (error) {
    console.error("Login upstream failed:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { success: false, message: "Tidak dapat menghubungi server autentikasi.", data: null, meta: { request_id: requestId }, errors: null },
      { status: 502 },
    );
  }

  const rawUpstream = await upstream.text();
  let body: { data?: { token?: string; expires_at?: string }; message?: string; [key: string]: unknown };
  try {
    body = JSON.parse(rawUpstream) as { data?: { token?: string; expires_at?: string }; [key: string]: unknown };
  } catch {
    return NextResponse.json(
      { success: false, message: "Server autentikasi mengembalikan respons yang tidak valid.", data: null, meta: { request_id: requestId }, errors: null },
      { status: 502 },
    );
  }

  if (!upstream.ok || !body.data?.token) {
    const result = NextResponse.json(body, { status: upstream.status });
    result.headers.set("X-Request-Id", upstream.headers.get("X-Request-Id") ?? requestId);
    return result;
  }

  const token = body.data.token;
  const result = NextResponse.json(
    {
      ...body,
      data: { ...body.data, token: undefined },
    },
    { status: upstream.status },
  );
  result.headers.set("X-Request-Id", upstream.headers.get("X-Request-Id") ?? requestId);
  result.cookies.set(process.env.SESSION_COOKIE_NAME ?? "gawe_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: body.data.expires_at ? new Date(body.data.expires_at) : undefined,
  });
  return result;
}
