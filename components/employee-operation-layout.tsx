"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiFetch } from "@/lib/api/client";
import type { Employee, EmployeeDocument } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";

export type EmployeeOperationTab = "profile" | "documents" | "contracts" | "mutations" | "resignations";

export function useEmployee(employeeId: string, enabled: boolean) {
  return useQuery({ queryKey: ["employee", employeeId], queryFn: () => apiFetch<Employee>(`employees/${employeeId}`), enabled });
}

export function EmployeeIdentityCard({ employee }: { employee: Employee }) {
  return <Card className="shadow-sm"><CardContent className="flex flex-wrap items-center gap-4 p-5"><div className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">{employee.full_name.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate font-semibold">{employee.full_name} <span className="font-normal text-muted-foreground">· {employee.employee_number}</span></p><p className="mt-1 truncate text-sm text-muted-foreground">{employee.position.name} · {employee.department.name} · {employee.branch.name}</p></div><Badge variant={employee.is_active ? "secondary" : "outline"}>{employee.is_active ? "Aktif" : "Nonaktif"}</Badge></CardContent></Card>;
}

export function EmployeeOperationNav({ employeeId, permissions, active }: { employeeId: string; permissions: string[]; active?: EmployeeOperationTab }) {
  const canViewEmployee = hasPermission(permissions, "employee.view");
  const documents = useQuery({
    queryKey: ["employee-documents", employeeId],
    queryFn: () => apiFetch<EmployeeDocument[]>(`employees/${employeeId}/documents`),
    enabled: canViewEmployee,
  });
  const documentCount = documents.data?.length ?? 0;
  const items: Array<{ key: EmployeeOperationTab; label: string; href: string; permission: string }> = [
    { key: "profile", label: "Profil", href: `/admin/employees/${employeeId}`, permission: "employee.view" },
    { key: "documents", label: documentCount > 0 ? `Dokumen (${documentCount})` : "Dokumen", href: `/admin/employees/${employeeId}/documents`, permission: "employee.view" },
    { key: "contracts", label: "Kontrak", href: `/admin/employees/${employeeId}/contracts`, permission: "contract.view" },
    { key: "mutations", label: "Mutasi", href: `/admin/employees/${employeeId}/mutations`, permission: "mutation.view" },
    { key: "resignations", label: "Resign", href: `/admin/employees/${employeeId}/resignations`, permission: "resignation.view" },
  ];
  return <nav aria-label="Menu karyawan" className="flex flex-wrap gap-2">{items.filter((item) => hasPermission(permissions, item.permission)).map((item) => {
    const isActive = item.key === active;
    return <Link key={item.key} href={item.href} aria-current={isActive ? "page" : undefined} className={`inline-flex h-9 items-center rounded-lg border px-4 text-[13px] font-medium transition-colors ${isActive ? "border-blue-100 bg-blue-50 text-blue-600" : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item.label}</Link>;
  })}</nav>;
}

export function EmployeeOperationHeader({ employee, title, description, formId, actionLabel, pending, permissions, active }: { employee: Employee; title: string; description: string; formId: string; actionLabel: string; pending: boolean; permissions: string[]; active: EmployeeOperationTab }) {
  return <><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Link href={`/admin/employees/${employee.id}`} className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 size-4" />Kembali ke detail</Link><p className="text-sm font-semibold text-primary">Karyawan · {employee.employee_number}</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div><div className="flex shrink-0 gap-2"><Button asChild variant="outline"><Link href={`/admin/employees/${employee.id}`}>Batal</Link></Button><Button type="submit" form={formId} disabled={pending}>{pending ? "Menyimpan..." : actionLabel}</Button></div></div><EmployeeIdentityCard employee={employee} /><EmployeeOperationNav employeeId={employee.id} permissions={permissions} active={active} /></>;
}
