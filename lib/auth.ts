import { cookies } from "next/headers";
import type { MeData } from "@/lib/api/types";

export async function getServerSession(): Promise<MeData | null> {
  const token = cookies().get(process.env.SESSION_COOKIE_NAME ?? "gawe_session")?.value;
  if (!token) return null;

  const response = await fetch(`${process.env.API_BASE_URL ?? "http://localhost/api/v1"}/auth/me`, {
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const body = (await response.json()) as { data: MeData };
  return body.data;
}
