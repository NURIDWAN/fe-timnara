"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Boxes, CalendarDays, FileText, Lock, Scale, Settings, Timer, Wallet } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { apiFetchEnvelope } from "@/lib/api/client";
import type { Employee } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";

export function PayrollShell({ permissions, current, title, description, children }: { permissions: string[]; current: string; title: string; description: string; children: ReactNode }) {
  return <div className="flex flex-col gap-5"><PageHeader eyebrow="Operasional · Payroll" title={title} description={description} /><PayrollNavigation permissions={permissions} current={current} />{children}</div>;
}

const payrollNav = [
  { href: "/admin/payroll", label: "Payroll Run", icon: Wallet, permission: "payroll.view" },
  { href: "/admin/payroll/periods", label: "Periode Payroll", icon: CalendarDays, permission: "payroll.view" },
  { href: "/admin/payroll/settings", label: "Pengaturan", icon: Settings, permission: "payroll.view" },
  { href: "/admin/payroll/components", label: "Komponen & Gaji", icon: Boxes, permission: "payroll.view" },
  { href: "/admin/payroll/payslips", label: "Slip Gaji", icon: FileText, permission: "payroll.view" },
  { href: "/admin/payroll/overtime", label: "Lembur", icon: Timer, permission: "payroll.view" },
  { href: "/admin/payroll/adjustments", label: "Penyesuaian & Suplisi", icon: Scale, permission: "payroll.view" },
  { href: "/admin/payroll/locks", label: "Lock Payroll", icon: Lock, permission: "payroll.view" },
] as const;

function PayrollNavigation({ permissions, current }: { permissions: string[]; current: string }) {
  const shown = payrollNav.filter((item) => hasPermission(permissions, item.permission));
  return <nav aria-label="Navigasi payroll" className="flex gap-2 overflow-x-auto pb-1">{shown.map((item) => { const Icon = item.icon; const active = current === item.href; return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm transition-colors ${active ? "border-primary/30 bg-accent font-medium text-accent-foreground" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="size-4" />{item.label}</Link>; })}</nav>;
}

export function Field({ label, children, error, hint, htmlFor }: { label: string; children: ReactNode; error?: string; hint?: string; htmlFor?: string }) {
  return <label htmlFor={htmlFor} className="flex flex-col gap-1.5 text-sm"><span className="font-medium">{label}</span>{children}{error ? <span role="alert" className="text-xs font-medium text-destructive">{error}</span> : null}{hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}</label>;
}

export function Metric({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-2 border-b py-2 text-sm last:border-b-0"><span className="text-muted-foreground">{label}</span><span className="max-w-[65%] text-right font-medium">{value}</span></div>;
}

const rupiah = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function formatRupiah(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return rupiah.format(value);
}

export function formatCompactRupiah(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  if (Math.abs(value) >= 1_000_000_000) return `Rp ${(value / 1_000_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
  if (Math.abs(value) >= 1_000_000) return `Rp ${(value / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  return rupiah.format(value);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function formatMonth(year: number, month: number) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(new Date(year, month - 1, 1));
}

export function formatMinutes(minutes: number | null | undefined) {
  if (minutes === null || minutes === undefined) return "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} m`;
  return rest === 0 ? `${hours} jam` : `${hours} jam ${rest} m`;
}

export function formatNumber(value: number | null | undefined, maximumFractionDigits = 1) {
  if (value === null || value === undefined) return "—";
  return value.toLocaleString("id-ID", { maximumFractionDigits });
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  calculating: "Menghitung",
  calculated: "Terhitung",
  reviewed: "Direview",
  locked: "Terkunci",
  published: "Dipublikasikan",
  cancelled: "Dibatalkan",
  pending: "Menunggu",
  approved: "Disetujui",
  rejected: "Ditolak",
  paid: "Dibayar",
  unlocked: "Terbuka",
  submitted: "Diajukan",
  in_review: "Dalam proses",
};

const statusClasses: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  calculating: "bg-sky-100 text-sky-800",
  calculated: "bg-blue-50 text-blue-700",
  reviewed: "bg-indigo-50 text-indigo-700",
  locked: "bg-amber-50 text-amber-800",
  published: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-slate-100 text-slate-600",
  pending: "bg-amber-50 text-amber-800",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  paid: "bg-emerald-100 text-emerald-800",
  unlocked: "bg-slate-100 text-slate-600",
  submitted: "bg-blue-50 text-blue-700",
  in_review: "bg-amber-50 text-amber-800",
};

export function statusLabel(status: string) {
  return statusLabels[status] ?? status;
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge className={statusClasses[status] ?? ""}>{statusLabel(status)}</Badge>;
}

export function useEmployeeList(enabled: boolean) {
  return useQuery({
    queryKey: ["employees", "payroll-options"],
    queryFn: () => apiFetchEnvelope<Employee[]>("employees?per_page=100&is_active=true"),
    enabled,
    staleTime: 60_000,
  });
}

export function EmployeeSelect({ employees, value, onChange, id, includeEmpty = true, required = false }: { employees: Employee[]; value: string; onChange: (value: string) => void; id?: string; includeEmpty?: boolean; required?: boolean }) {
  return <select id={id} required={required} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>{includeEmpty ? <option value="">Pilih karyawan</option> : null}{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_number}</option>)}</select>;
}

export function employeeLabel(employee?: { full_name?: string; employee_number?: string } | null, fallback?: string) {
  if (!employee) return fallback ?? "—";
  return `${employee.full_name ?? ""}${employee.employee_number ? ` · ${employee.employee_number}` : ""}`;
}
