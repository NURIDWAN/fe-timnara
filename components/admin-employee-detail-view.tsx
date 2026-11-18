"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Trash2, UserCheck, UserX } from "lucide-react";
import { toast } from "sonner";
import { EmployeeOperationNav } from "@/components/employee-operation-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiFetch, apiFetchEnvelope } from "@/lib/api/client";
import type { AuditLog, Contract, Employee } from "@/lib/api/types";
import { ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { hasPermission } from "@/lib/permissions";

const employeeSubjectType = "App\\Domain\\Employee\\Models\\Employee";

const contractStatusLabels: Record<string, string> = {
  draft: "Draft",
  active: "Aktif",
  expiring: "Segera berakhir",
  expired: "Berakhir",
  terminated: "Dihentikan",
};

const maritalStatusLabels: Record<string, string> = {
  single: "Lajang",
  married: "Menikah",
  divorced: "Cerai",
  widowed: "Janda/Duda",
};

const activityLabels: Record<string, string> = {
  "employee.created": "Karyawan dibuat",
  "employee.updated": "Data karyawan diperbarui",
  "employee.deleted": "Karyawan dihapus",
  "employee.activated": "Karyawan diaktifkan",
  "employee.deactivated": "Karyawan dinonaktifkan",
  "employee.photo_updated": "Foto karyawan diperbarui",
  "employee.imported": "Karyawan diimpor",
};

const activityDescriptions: Record<string, string> = {
  "employee.created": "Data karyawan ditambahkan ke tenant",
  "employee.updated": "Perubahan data karyawan dicatat pada audit log",
  "employee.deleted": "Data karyawan dihapus dari daftar aktif",
  "employee.activated": "Status kepegawaian diaktifkan kembali",
  "employee.deactivated": "Status kepegawaian dinonaktifkan",
  "employee.photo_updated": "Foto profil karyawan diperbarui",
  "employee.imported": "Data karyawan diimpor dari berkas",
};

export function AdminEmployeeDetailView({ employeeId, permissions }: { employeeId: string; permissions: string[] }) {
  const queryClient = useQueryClient();
  const canView = hasPermission(permissions, "employee.view");
  const canManage = hasPermission(permissions, "employee.manage");
  const canViewContracts = hasPermission(permissions, "contract.view");
  const canViewAudit = hasPermission(permissions, "audit.view");

  const employee = useQuery({ queryKey: ["employee", employeeId], queryFn: () => apiFetch<Employee>(`employees/${employeeId}`), enabled: canView });
  const contracts = useQuery({
    queryKey: ["employee-contracts", employeeId, "latest"],
    queryFn: () => apiFetchEnvelope<Contract[]>(`employees/${employeeId}/contracts?per_page=1&page=1`),
    enabled: canView && canViewContracts,
  });
  const activity = useQuery({
    queryKey: ["employee-activity", employeeId],
    queryFn: () => apiFetchEnvelope<AuditLog[]>(`audit-logs?subject_type=${encodeURIComponent(employeeSubjectType)}&subject_id=${encodeURIComponent(employeeId)}&sort=-created_at&per_page=6&page=1`),
    enabled: canView && canViewAudit,
  });
  const action = useMutation({
    mutationFn: (type: "delete" | "activate" | "deactivate") => type === "delete"
      ? apiFetch<null>(`employees/${employeeId}`, { method: "DELETE" })
      : apiFetch<Employee>(`employees/${employeeId}/${type}`, { method: "POST" }),
    onSuccess: async (_, type) => {
      if (type === "delete") {
        window.location.assign("/admin/employees");
        return;
      }
      toast.success(type === "activate" ? "Karyawan diaktifkan" : "Karyawan dinonaktifkan");
      await queryClient.invalidateQueries({ queryKey: ["employee", employeeId] });
      await queryClient.invalidateQueries({ queryKey: ["employees"] });
      await queryClient.invalidateQueries({ queryKey: ["employee-activity", employeeId] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!canView) return <UnauthorizedState />;
  if (employee.isLoading) return <LoadingState label="Memuat detail karyawan" />;
  if (employee.isError || !employee.data) return <ErrorState message={getErrorMessage(employee.error)} retry={() => void employee.refetch()} />;

  const value = employee.data;
  const contract = contracts.data?.data?.[0];
  const contractDaysRemaining = contract?.days_remaining ?? null;
  const showContractAlert = contract !== undefined && (contract.status === "active" || contract.status === "expiring") && contractDaysRemaining !== null && contractDaysRemaining <= 30;

  return <div className="space-y-4">
    <Card className="gap-0 overflow-visible py-0 shadow-sm">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-blue-100 text-2xl font-semibold text-blue-700" aria-hidden="true">{initials(value.full_name)}</div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-bold leading-tight tracking-tight">{value.full_name}</h1>
          <p className="mt-1 truncate text-[13px] text-muted-foreground">{value.employee_number} · {value.position.name} · {value.department.name}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className={`h-[21px] rounded-full border-transparent px-2.5 text-[11px] ${value.is_active ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-50" : "bg-slate-100 text-slate-600 hover:bg-slate-100"}`}>{value.is_active ? "Aktif" : "Nonaktif"}</Badge>
            <Badge className="h-[21px] rounded-full border-transparent bg-blue-50 px-2.5 text-[11px] text-blue-600 hover:bg-blue-50">{value.employment_status.name}</Badge>
          </div>
        </div>
        {canManage ? <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Aksi karyawan" disabled={action.isPending}><MoreHorizontal className="size-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem disabled={action.isPending} onSelect={() => action.mutate(value.is_active ? "deactivate" : "activate")}>
              {value.is_active ? <UserX /> : <UserCheck />}{value.is_active ? "Nonaktifkan" : "Aktifkan"}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" disabled={action.isPending} onSelect={() => { if (window.confirm(`Hapus ${value.full_name}? Data karyawan akan dinonaktifkan dan dihapus dari daftar.`)) action.mutate("delete"); }}>
              <Trash2 />Hapus karyawan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> : null}
      </div>
    </Card>

    <EmployeeOperationNav employeeId={value.id} permissions={permissions} active="profile" />

    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(320px,1fr)]">
      <Card className="gap-0 py-0 shadow-sm">
        <section className="space-y-4 p-5">
          <h2 className="text-[15px] font-semibold">Data Pribadi</h2>
          <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            <DetailField label="Nama lengkap" value={value.full_name} />
            <DetailField label="Nama panggilan" value={value.nickname} />
            <DetailField label="Jenis kelamin" value={value.gender === "male" ? "Laki-laki" : "Perempuan"} />
            <DetailField label="Tanggal lahir" value={formatDate(value.birth_date)} />
            <DetailField label="Status pernikahan" value={maritalStatusLabels[value.marital_status ?? ""] ?? humanize(value.marital_status)} />
            <DetailField label="Pendidikan" value={value.education_level} />
            <DetailField label="No. HP" value={value.phone} />
            <DetailField label="Email" value={value.email} />
          </dl>
        </section>
      </Card>

      <Card className="gap-0 py-0 shadow-sm">
        <section className="space-y-3 p-5">
          <h2 className="text-[15px] font-semibold">Informasi Kepegawaian</h2>
          <dl className="space-y-3">
            <InfoRow label="Status kontrak" value={contract ? contractStatusLabels[contract.status] ?? contract.status : undefined} />
            <InfoRow label="Jabatan" value={value.position.name} />
            <InfoRow label="Departemen" value={value.department.name} />
            <InfoRow label="Cabang utama" value={value.branch.name} />
            <InfoRow label="Atasan langsung" value={value.supervisor?.full_name} />
            <InfoRow label="Lokasi terkunci" value={value.lock_location ? "Ya" : "Tidak"} />
          </dl>
          {showContractAlert ? <div className="rounded-lg bg-amber-50 p-3">
            <p className="text-xs font-semibold text-amber-700">{contractDaysRemaining > 0 ? `Kontrak berakhir ${contractDaysRemaining} hari lagi` : "Kontrak telah berakhir"}</p>
            <p className="mt-0.5 text-[11px] text-amber-600">Pengingat berikutnya: 7 hari sebelum berakhir</p>
          </div> : null}
        </section>
      </Card>
    </div>

    <Card className="gap-0 py-0 shadow-sm">
      <section className="space-y-3 p-5">
        <h2 className="text-[15px] font-semibold">Aktivitas Terakhir</h2>
        {!canViewAudit ? <p className="text-xs text-muted-foreground">Riwayat aktivitas memerlukan permission audit.view.</p> : activity.isLoading ? <p className="text-xs text-muted-foreground">Memuat aktivitas…</p> : activity.isError ? <p className="text-xs text-muted-foreground">Riwayat aktivitas tidak dapat dimuat.</p> : activity.data?.data?.length ? <ol className="space-y-4">
          {activity.data.data.map((log, index) => <li key={log.id} className="flex items-start gap-2.5">
            <span className={`mt-1 size-2 shrink-0 rounded-full ${index === 0 ? "bg-blue-600" : "bg-slate-300"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">{activityLabels[log.action] ?? log.action}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{activityDescriptions[log.action] ?? "Aktivitas tercatat pada audit log"}</p>
            </div>
            <time dateTime={log.created_at ?? undefined} className="shrink-0 text-[11px] text-muted-foreground">{formatDateTime(log.created_at)}</time>
          </li>)}
        </ol> : <p className="text-xs text-muted-foreground">Belum ada aktivitas tercatat untuk karyawan ini.</p>}
      </section>
    </Card>
  </div>;
}

function DetailField({ label, value }: { label: string; value: string | null | undefined }) {
  return <div><dt className="text-[11px] text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-[13px] font-medium">{empty(value)}</dd></div>;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="text-right text-xs font-medium">{empty(value)}</dd></div>;
}

function empty(value: string | null | undefined) {
  return value && value.trim() ? value : "—";
}

function humanize(value: string | null) {
  if (!value) return null;
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("");
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric" }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
