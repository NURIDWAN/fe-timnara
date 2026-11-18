"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [tenantCode, setTenantCode] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const storedDeviceId = window.localStorage.getItem("gawe_web_device_id");
      const deviceId = storedDeviceId ?? `gawe-web-${crypto.randomUUID()}`;
      if (!storedDeviceId) window.localStorage.setItem("gawe_web_device_id", deviceId);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          password,
          tenant_code: tenantCode || undefined,
          device: {
            device_id: deviceId,
            platform: "web",
            device_name: "Browser Web",
            app_version: "web",
          },
        }),
      });
      const rawBody = await response.text();
      let body: { message?: string; success?: boolean; meta?: { retry_after?: number }; errors?: Record<string, string[]> | null };
      try {
        body = JSON.parse(rawBody) as { message?: string; success?: boolean; meta?: { retry_after?: number }; errors?: Record<string, string[]> | null };
      } catch {
        throw new Error("Server mengembalikan respons yang tidak valid.");
      }
      if (!response.ok || !body.success) {
        const retryAfter = body.meta?.retry_after;
        const retryMessage = typeof retryAfter === "number" ? ` Coba lagi dalam ${retryAfter} detik.` : "";
        const validationMessage = body.errors ? Object.values(body.errors).flat().join(" ") : "";
        throw new Error(`${validationMessage || body.message || "Login tidak berhasil."}${retryMessage}`);
      }
      toast.success("Selamat datang kembali");
      router.replace(searchParams.get("next") ?? "/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Login tidak berhasil.");
    } finally {
      setPending(false);
    }
  }

  return <Card className="rounded-2xl border-border/70 bg-card/95 shadow-[0_20px_60px_-24px_hsl(var(--foreground)/0.35)]"><CardHeader className="flex-row items-start gap-4 space-y-0 px-7 pb-5 pt-7"><div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><LockKeyhole className="size-5" /></div><div><CardTitle className="text-xl tracking-tight">Masuk ke workspace</CardTitle><CardDescription className="mt-1.5 leading-5">Kelola operasional HR dengan konteks tenant yang aman.</CardDescription></div></CardHeader><CardContent className="px-7 pb-7"><form className="flex flex-col gap-4" onSubmit={submit}><div className="flex flex-col gap-2"><Label htmlFor="username">Username</Label><Input className="h-11 bg-background" id="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></div><div className="flex flex-col gap-2"><Label htmlFor="password">Password</Label><Input className="h-11 bg-background" id="password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div><div className="flex flex-col gap-2"><Label htmlFor="tenant_code">Kode tenant</Label><Input className="h-11 bg-background" id="tenant_code" placeholder="contoh: demo" value={tenantCode} onChange={(event) => setTenantCode(event.target.value)} required /></div><Button type="submit" className="mt-2 h-11 w-full gap-2" disabled={pending}>{pending ? "Memeriksa..." : "Masuk"}{!pending ? <ArrowRight className="size-4" /> : null}</Button></form></CardContent></Card>;
}
