"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasPermission } from "@/lib/permissions";

const items = [
  { href: "/admin/operations/visits", label: "Kunjungan", permission: "visit.view" },
  { href: "/admin/operations/activities", label: "Aktivitas", permission: "activity.view" },
  { href: "/admin/operations/violations", label: "Pelanggaran", permission: "violation.view" },
  { href: "/admin/operations/announcements", label: "Pengumuman", permission: ["announcement.view", "announcement.manage"] },
  { href: "/admin/operations/lms", label: "LMS", permission: ["lms.view", "lms.manage"] },
];

function canAccess(permissions: string[], required: string | string[]): boolean {
  return Array.isArray(required)
    ? required.some((permission) => hasPermission(permissions, permission))
    : hasPermission(permissions, required);
}

export function Phase6Navigation({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi operasional" className="flex gap-2 overflow-x-auto pb-1">
      {items.filter((item) => canAccess(permissions, item.permission)).map((item) => {
        const active = pathname === item.href;
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={`inline-flex h-9 shrink-0 items-center rounded-lg border px-3 text-sm transition-colors ${active ? "border-blue-100 bg-blue-50 font-medium text-blue-700" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item.label}</Link>;
      })}
    </nav>
  );
}
