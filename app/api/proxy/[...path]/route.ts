import { NextRequest, NextResponse } from "next/server";

function requestId(headers: Headers): string {
  const incoming = headers.get("x-request-id")?.trim();
  if (incoming && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(incoming)) {
    return incoming;
  }
  return crypto.randomUUID();
}

async function proxy(request: NextRequest, context: { params: { path: string[] } }) {
  const token = request.cookies.get(process.env.SESSION_COOKIE_NAME ?? "gawe_session")?.value;
  const target = `${process.env.API_BASE_URL ?? "http://localhost/api/v1"}/${context.params.path.join("/")}${request.nextUrl.search}`;
  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("cookie");
  headers.delete("accept-encoding");
  const id = requestId(headers);
  headers.set("X-Request-Id", id);
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer(),
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "API backend tidak dapat dihubungi.", data: null, meta: { request_id: id }, errors: null },
      { status: 502, headers: { "X-Request-Id": id } },
    );
  }

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");
  responseHeaders.delete("connection");
  responseHeaders.delete("keep-alive");

  return new NextResponse(response.body, { status: response.status, headers: responseHeaders });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
