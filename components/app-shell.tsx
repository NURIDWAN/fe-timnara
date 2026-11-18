"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  Building2,
  ChevronRight,
  Bell,
  BriefcaseBusiness,
  LayoutDashboard,
  LogOut,
  Menu,
  Pencil,
  CalendarDays,
  Clock3,
  Heart,
  Search,
  ShieldCheck,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import type { MeData } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";

type NavChild = { href: string; label: string; permission: string | string[] };
type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; permission: string | string[] | null; children?: NavChild[] };

const navigation: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: null },
  {
    href: "/admin/employees",
    label: "Karyawan",
    icon: Users,
    permission: "employee.view",
    children: [
      { href: "/admin/employees", label: "Daftar karyawan", permission: "employee.view" },
      { href: "/admin/employees/new", label: "Tambah karyawan", permission: "employee.manage" },
    ],
  },
  {
    href: "/admin/attendance",
    label: "Presensi",
    icon: Clock3,
    permission: "attendance.view",
    children: [
      { href: "/admin/attendance", label: "Monitoring", permission: "attendance.view" },
    ],
  },
  {
    href: "/admin/scheduling",
    label: "Jadwal",
    icon: CalendarDays,
    permission: ["schedule.view", "shift_pattern.view", "roster.view", "shift_swap.view"],
    children: [
      { href: "/admin/scheduling", label: "Master Jadwal", permission: "schedule.view" },
      { href: "/admin/scheduling/assignments", label: "Assignment", permission: "schedule.view" },
      { href: "/admin/scheduling/patterns", label: "Pola Shift", permission: "shift_pattern.view" },
      { href: "/admin/scheduling/roster", label: "Roster", permission: "roster.view" },
      { href: "/admin/scheduling/min-personnel", label: "Minimum Personel", permission: "roster.view" },
      { href: "/admin/scheduling/swaps", label: "Tukar Shift", permission: "shift_swap.view" },
    ],
  },
  {
    href: "/admin/leaves",
    label: "Cuti",
    icon: Heart,
    permission: ["leave.view", "holiday.view", "approval.view"],
    children: [
      { href: "/admin/leaves", label: "Ringkasan", permission: "leave.view" },
      { href: "/admin/leaves/requests", label: "Pengajuan", permission: "leave.view" },
      { href: "/admin/leaves/types", label: "Jenis Cuti", permission: "leave.view" },
      { href: "/admin/leaves/balances", label: "Saldo Cuti", permission: "leave.view" },
      { href: "/admin/leaves/calendar", label: "Kalender Cuti", permission: "leave.view" },
      { href: "/admin/leaves/permits", label: "Izin Terlambat/Pulang", permission: "leave.view" },
      { href: "/admin/holidays", label: "Hari Libur", permission: "holiday.view" },
      { href: "/admin/approvals/inbox", label: "Persetujuan", permission: "approval.view" },
      { href: "/admin/approvals/outbox", label: "Pengajuan Saya", permission: "approval.view" },
      { href: "/admin/approvals/configuration", label: "Konfigurasi Approval", permission: "approval.view" },
    ],
  },
  {
    href: "/admin/payroll",
    label: "Payroll",
    icon: Wallet,
    permission: "payroll.view",
    children: [
      { href: "/admin/payroll", label: "Payroll Run", permission: "payroll.view" },
      { href: "/admin/payroll/components", label: "Komponen & Gaji", permission: "payroll.view" },
      { href: "/admin/payroll/periods", label: "Periode Payroll", permission: "payroll.view" },
      { href: "/admin/payroll/payslips", label: "Slip Gaji", permission: "payroll.view" },
      { href: "/admin/payroll/overtime", label: "Lembur", permission: "payroll.view" },
      { href: "/admin/payroll/adjustments", label: "Penyesuaian & Suplisi", permission: "payroll.view" },
      { href: "/admin/payroll/locks", label: "Lock Payroll", permission: "payroll.view" },
      { href: "/admin/payroll/settings", label: "Pengaturan", permission: "payroll.view" },
    ],
  },
  {
    href: "/admin/operations/visits",
    label: "Operasional",
    icon: BriefcaseBusiness,
    permission: ["visit.view", "activity.view", "violation.view", "announcement.view", "announcement.manage", "lms.view", "lms.manage"],
    children: [
      { href: "/admin/operations/visits", label: "Kunjungan", permission: "visit.view" },
      { href: "/admin/operations/activities", label: "Aktivitas", permission: "activity.view" },
      { href: "/admin/operations/violations", label: "Pelanggaran", permission: "violation.view" },
      { href: "/admin/operations/announcements", label: "Pengumuman", permission: ["announcement.view", "announcement.manage"] },
      { href: "/admin/operations/lms", label: "Pembelajaran", permission: ["lms.view", "lms.manage"] },
    ],
  },
  {
    href: "/admin/organization",
    label: "Organisasi",
    icon: Building2,
    permission: ["branch.view", "department.view", "position.view", "group.view", "reference.view"],
    children: [
      { href: "/admin/organization", label: "Ringkasan", permission: ["branch.view", "department.view", "position.view", "group.view", "reference.view"] },
      { href: "/admin/organization/branches", label: "Kelola cabang", permission: "branch.view" },
      { href: "/admin/organization/departments", label: "Departemen", permission: "department.view" },
      { href: "/admin/organization/positions", label: "Jabatan", permission: "position.view" },
      { href: "/admin/organization/groups", label: "Grup karyawan", permission: "group.view" },
      { href: "/admin/organization/employment-statuses", label: "Status kepegawaian", permission: "reference.view" },
    ],
  },
  {
    href: "/admin/users",
    label: "Pengguna Tenant",
    icon: Users,
    permission: ["user.view", "user.create"],
    children: [
      { href: "/admin/users", label: "Daftar pengguna", permission: "user.view" },
      { href: "/admin/users/new", label: "Tambah pengguna", permission: "user.create" },
    ],
  },
  { href: "/admin/roles", label: "Role & akses", icon: BarChart3, permission: "role.view" },
  { href: "/admin/audit-logs", label: "Audit Log", icon: ShieldCheck, permission: "audit.view" },
];

function canAccess(permissions: string[], permission: string | string[] | null) {
  if (!permission) return true;
  if (Array.isArray(permission)) return permission.some((item) => hasPermission(permissions, item));
  return hasPermission(permissions, permission);
}

export function AppShell({ children, session }: { children: React.ReactNode; session: MeData }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const employeeDetailId = pathname.match(/^\/admin\/employees\/([^/]+)$/)?.[1];
  const isEmployeeDetail = Boolean(employeeDetailId) && employeeDetailId !== "new";

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-background">
      {open ? <button className="fixed inset-0 z-30 bg-foreground/20 lg:hidden" aria-label="Tutup menu" onClick={() => setOpen(false)} /> : null}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r bg-card px-4 py-6 transition-transform lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3" onClick={() => setOpen(false)}>
            <div className="size-8 rounded-lg bg-primary" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold tracking-tight">GAWE HRIS</p>
              <p className="text-xs text-muted-foreground">Operational workspace</p>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(false)} aria-label="Tutup menu"><X /></Button>
        </div>
        <Separator className="my-6" />
        <nav className="flex flex-1 flex-col gap-1">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Menu utama</p>
           {navigation.filter((item) => canAccess(session.user.permissions, item.permission)).map((item) => {
              const isOperations = item.href.startsWith("/admin/operations/");
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`) || (isOperations && pathname.startsWith("/admin/operations/"));
              const Icon = item.icon;
              const children = (item.children ?? []).filter((child) => canAccess(session.user.permissions, child.permission));
              const itemHref = isOperations && !children.some((child) => child.href === item.href) ? children[0]?.href ?? item.href : item.href;
              return <div key={item.href}><Link href={itemHref} onClick={() => setOpen(false)} className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}><Icon className="size-4" />{item.label}{active ? <ChevronRight className="ml-auto size-4" /> : null}</Link>{active && children.length > 0 ? <div className="ml-9 mt-1 space-y-1 border-l pl-3">{children.map((child) => { const childActive = pathname === child.href; return <Link key={child.href} href={child.href} onClick={() => setOpen(false)} className={`block py-1 text-xs transition-colors ${childActive ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{child.label}</Link>; })}</div> : null}</div>;
           })}
          <p className="mb-2 mt-7 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Lainnya</p>
          {hasPermission(session.user.permissions, "device.view") ? <Link href="/me/sessions" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Users className="size-4" />Session & device</Link> : null}
          <Link href="/me/profile" onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Users className="size-4" />Profil saya</Link>
        </nav>
        <div className="rounded-xl bg-muted/60 p-3">
          <div className="flex items-center gap-3"><Avatar className="size-9"><AvatarFallback>{session.user.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><div className="min-w-0"><p className="truncate text-sm font-medium">{session.user.name}</p><p className="truncate text-xs text-muted-foreground">{session.tenant.name}</p></div></div>
          <Button variant="ghost" size="sm" className="mt-3 w-full justify-start gap-2 text-muted-foreground" onClick={logout}><LogOut className="size-4" />Keluar</Button>
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b bg-background/90 px-4 backdrop-blur sm:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Buka menu"><Menu /></Button>
          <div className="hidden sm:block">{pathname.startsWith("/admin/roles") ? <><p className="text-lg font-semibold tracking-tight">Role &amp; Akses</p><p className="text-xs text-muted-foreground">Role tenant dan permission granular</p></> : isEmployeeDetail ? <p className="text-lg font-semibold tracking-tight">Detail Karyawan</p> : pathname.startsWith("/admin/attendance") ? <p className="text-lg font-semibold tracking-tight">Presensi</p> : pathname.startsWith("/admin/scheduling") ? <p className="text-lg font-semibold tracking-tight">Jadwal &amp; Roster</p> : pathname.startsWith("/admin/payroll") ? <p className="text-lg font-semibold tracking-tight">Payroll</p> : pathname.startsWith("/admin/operations") ? <p className="text-lg font-semibold tracking-tight">Operasional</p> : pathname.startsWith("/admin/audit-logs") ? <p className="text-lg font-semibold tracking-tight">Audit Log</p> : <p className="text-lg font-semibold tracking-tight">{pathname === "/dashboard" ? "Dashboard" : session.tenant.name}</p>}</div>
          <div className="ml-auto flex items-center gap-3">{isEmployeeDetail ? <><Button asChild variant="outline" size="lg" className="hidden px-3.5 sm:inline-flex"><Link href="/admin/employees"><ArrowLeft className="mr-2 size-4" />Kembali</Link></Button>{hasPermission(session.user.permissions, "employee.manage") ? <Button asChild size="lg" className="px-3.5"><Link href={`/admin/employees/${employeeDetailId}/edit`}><Pencil className="mr-2 size-4" />Edit Karyawan</Link></Button> : null}</> : null}<div className="relative hidden w-56 sm:block"><SearchIcon /><Input aria-label="Cari karyawan" className="h-9 border-slate-200 bg-slate-50 pl-9 text-xs" placeholder="Cari karyawan..." /></div><Button variant="outline" size="icon" className="relative border-slate-200 bg-white" aria-label="Notifikasi"><Bell className="size-4 text-slate-500" /><span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-red-600" /></Button><Avatar className="size-8 border border-blue-300 bg-blue-100"><AvatarFallback className="bg-blue-100 text-blue-700">{session.user.name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><span className="hidden text-sm font-medium sm:inline">{session.user.name}</span></div>
        </header>
        <main className="mx-auto max-w-[1500px] p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function SearchIcon() {
  return <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />;
}
