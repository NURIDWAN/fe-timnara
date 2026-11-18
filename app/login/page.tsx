import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Masuk · GAWE HRIS" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen overflow-hidden bg-background lg:grid-cols-[1.1fr_0.9fr]">
      <section className="hidden flex-col justify-between bg-primary p-10 text-primary-foreground lg:flex xl:p-14">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary-foreground/15 font-bold">G</div>
          <span className="font-semibold">GAWE HRIS</span>
        </div>
        <div className="max-w-xl">
          <p className="mb-5 text-sm font-medium uppercase tracking-[0.2em] text-white/90">Operational calm</p>
          <h1 className="text-5xl font-semibold leading-tight tracking-tight">Satu tempat untuk keputusan HR yang lebih jernih.</h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-white/90">Presensi, karyawan, jadwal, cuti, dan approval dalam satu workspace yang mengikuti aturan tenant Anda.</p>
        </div>
        <p className="text-sm text-white/90">E-Presensi GPS V2 · Admin Web</p>
      </section>
      <section className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)),transparent_42%)] px-5 py-8 sm:px-10 sm:py-12 lg:bg-background">
        <div className="w-full max-w-lg">
          <div className="mb-7 lg:hidden">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">G</div>
              <div><p className="font-semibold tracking-tight">GAWE HRIS</p><p className="text-xs text-muted-foreground">Operational workspace</p></div>
            </div>
          </div>
          <Suspense fallback={<div className="h-[420px] animate-pulse rounded-2xl bg-muted" />}><LoginForm /></Suspense>
          <p className="mt-5 text-center text-xs leading-5 text-muted-foreground">Akses dan data Anda dilindungi oleh permission serta isolasi tenant.</p>
        </div>
      </section>
    </main>
  );
}
