"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { hasPermission } from "@/lib/permissions";

const items = [
  { href: "/admin/attendance", label: "Presensi", permission: "attendance.view" },
  { href: "/admin/scheduling", label: "Master Jadwal", permission: "schedule.view" },
  { href: "/admin/scheduling/assignments", label: "Assignment", permission: "schedule.view" },
  { href: "/admin/scheduling/patterns", label: "Pola Shift", permission: "shift_pattern.view" },
  { href: "/admin/scheduling/roster", label: "Roster", permission: "roster.view" },
  { href: "/admin/scheduling/min-personnel", label: "Minimum Personel", permission: "roster.view" },
  { href: "/admin/scheduling/swaps", label: "Tukar Shift", permission: "shift_swap.view" },
];

export function Phase2Navigation({ permissions }: { permissions: string[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi jadwal dan presensi" className="flex gap-2 overflow-x-auto pb-1">
      {items.filter((item) => hasPermission(permissions, item.permission)).map((item) => {
        const active = pathname === item.href || (item.href !== "/admin/scheduling" && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex h-9 shrink-0 items-center rounded-lg border px-3 text-sm transition-colors ${active ? "border-blue-100 bg-blue-50 font-medium text-blue-700" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
