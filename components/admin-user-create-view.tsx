"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, UserRoundPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { errorFields, FormField, TextField } from "@/components/admin-form";
import { ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, apiFetchEnvelope } from "@/lib/api/client";
import type { Employee, Member, Role, StoreUserRequest, Tenant } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";

const roleDescriptions: Record<string, string> = {
  employee: "Akses layanan mandiri",
  supervisor: "Approval dan data tim",
  hr_admin: "Karyawan, jadwal, presensi",
  tenant_admin: "Administrasi tenant",
  tenant_owner: "Pemilik tenant",
};

export function AdminUserCreateView({ permissions, tenant }: { permissions: string[]; tenant: Tenant }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const canCreate = hasPermission(permissions, "user.create");
  const canViewRoles = hasPermission(permissions, "role.view");
  const canViewEmployees = hasPermission(permissions, "employee.view");
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => apiFetch<Role[]>("roles"), enabled: canCreate && canViewRoles });
  const employees = useQuery({ queryKey: ["employees", "user-form"], queryFn: () => apiFetchEnvelope<Employee[]>("employees?per_page=100").then((response) => response.data ?? []), enabled: canCreate && canViewEmployees });
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  useEffect(() => {
    if (!selectedRoles.length && roles.data?.some((role) => role.name === "employee")) setSelectedRoles(["employee"]);
  }, [roles.data, selectedRoles.length]);

  const create = useMutation({
    mutationFn: (payload: StoreUserRequest) => apiFetch<Member>("users", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => {
      toast.success("Pengguna tenant berhasil ditambahkan");
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      await queryClient.invalidateQueries({ queryKey: ["roles"] });
      router.push("/admin/users");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!canCreate) return <UnauthorizedState />;
  if ((canViewRoles && roles.isLoading) || (canViewEmployees && employees.isLoading)) return <LoadingState label="Memuat role dan data karyawan" />;
  if (canViewRoles && roles.isError) return <ErrorState message={getErrorMessage(roles.error)} retry={() => void roles.refetch()} />;
  if (canViewEmployees && employees.isError) return <ErrorState message={getErrorMessage(employees.error)} retry={() => void employees.refetch()} />;
  const fields = errorFields(create.error);
  const availableRoles = roles.data ?? [];
  const employeeRole = availableRoles.find((role) => role.name === "employee");
  const canAssignRoles = canViewRoles && availableRoles.length > 0;

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
      <div><Button asChild variant="ghost" size="sm" className="mb-2 -ml-2"><Link href="/admin/users"><ArrowLeft className="mr-2 size-4" />Kembali ke pengguna</Link></Button><p className="text-lg font-semibold tracking-tight">Tambah Pengguna Tenant</p><p className="text-xs text-muted-foreground">POST /users · permission user.create</p></div>
      <div className="flex gap-2"><Button asChild variant="outline"><Link href="/admin/users">Batal</Link></Button><Button type="submit" form="create-tenant-user" disabled={create.isPending || (canAssignRoles && !selectedRoles.length)}>{create.isPending ? "Menyimpan..." : "Simpan Pengguna"}</Button></div>
    </header>

    <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4">
      <p className="text-sm font-semibold text-blue-700">Tenant aktif: {tenant.name}</p>
      <p className="mt-1 text-xs text-slate-600">Membership akan dibuat pada tenant <code>{tenant.code}</code> setelah user berhasil disimpan.</p>
    </div>

    {create.error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><p className="font-medium">Pengguna belum dapat disimpan</p><p className="mt-1">{getErrorMessage(create.error)}</p></div> : null}

    <form id="create-tenant-user" className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]" noValidate onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const rolesPayload = canAssignRoles ? selectedRoles : undefined;
      if (canAssignRoles && !selectedRoles.length) { toast.error("Pilih minimal satu role tenant"); return; }
      create.mutate({
        name: String(form.get("name") ?? "").trim(),
        username: String(form.get("username") ?? "").trim(),
        email: String(form.get("email") ?? "").trim() || null,
        phone: String(form.get("phone") ?? "").trim() || null,
        employee_id: String(form.get("employee_id") ?? "") || null,
        password: String(form.get("password") ?? ""),
        ...(rolesPayload ? { roles: rolesPayload } : {}),
      });
    }}>
      <Card><CardHeader><CardTitle>Data Pengguna</CardTitle><p className="text-xs text-muted-foreground">User global dibuat bila username belum terdaftar.</p></CardHeader><CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Nama Lengkap" name="name" required autoComplete="name" error={fields.name} />
          <TextField label="Username" name="username" required autoComplete="username" error={fields.username} />
          <TextField label="Email" name="email" type="email" autoComplete="email" error={fields.email} />
          <TextField label="Nomor Telepon" name="phone" type="tel" autoComplete="tel" error={fields.phone} />
          {canViewEmployees ? <FormField label="Hubungkan ke Karyawan" name="employee_id" error={fields.employee_id}><select id="employee_id" name="employee_id" defaultValue="" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="">Tidak dihubungkan</option>{(employees.data ?? []).map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_number} · {employee.full_name}</option>)}</select></FormField> : <div className="sm:col-span-2 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Pemilihan karyawan memerlukan permission employee.view.</div>}
          <div className="sm:col-span-2 sm:max-w-sm"><TextField label="Password" name="password" type="password" required minLength={8} autoComplete="new-password" error={fields.password} /><p className="mt-1 text-[11px] text-muted-foreground">Minimal 8 karakter. Password hanya digunakan saat create dan tidak dikembalikan API.</p></div>
        </div>
        <div className="rounded-lg bg-muted/40 p-4"><p className="text-sm font-medium">Employee linking opsional</p><p className="mt-1 text-xs text-muted-foreground">Jika dipilih, karyawan harus berasal dari tenant ini dan belum terhubung ke pengguna lain.</p></div>
      </CardContent></Card>

      <Card><CardHeader><CardTitle>Role Tenant</CardTitle><p className="text-xs text-muted-foreground">Pilih role akses untuk anggota tenant.</p></CardHeader><CardContent className="space-y-3">
        {!canViewRoles ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Pemilihan role memerlukan permission role.view. Jika tidak dikirim, API memakai default employee.</p> : null}
        {canViewRoles && !availableRoles.length ? <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">Belum ada role yang tersedia untuk dipilih. Pemberian role memerlukan permission role.view.</p> : null}
        {canAssignRoles ? availableRoles.map((role) => {
          const checked = selectedRoles.includes(role.name);
          return <label key={role.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${checked ? "border-blue-300 bg-blue-50" : "hover:bg-muted/40"}`}>
            <input className="mt-1 size-4 accent-blue-600" type="checkbox" checked={checked} onChange={() => setSelectedRoles((current) => checked ? current.filter((name) => name !== role.name) : [...current, role.name])} />
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{role.name.replaceAll("_", " ").replace(/\\b\\w/g, (letter) => letter.toUpperCase())}</span><span className="mt-1 block text-xs text-muted-foreground">{roleDescriptions[role.name] ?? (role.is_default ? "Role default tenant" : "Role kustom tenant")}</span></span>
            {checked ? <Badge variant="secondary" className="gap-1"><Check className="size-3" />Dipilih</Badge> : null}
          </label>;
        }) : null}
        {canAssignRoles && !selectedRoles.length ? <p role="status" className="text-xs text-amber-700">Pilih minimal satu role sebelum menyimpan.</p> : null}
        {employeeRole && selectedRoles.length === 0 ? <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setSelectedRoles([employeeRole.name])}><UserRoundPlus className="mr-2 size-4" />Pilih Employee</Button> : null}
        <p className="pt-2 text-[11px] text-muted-foreground">Aksi ini memerlukan permission user.create. Perubahan role dapat dikelola setelah pengguna ditambahkan.</p>
      </CardContent></Card>
    </form>
  </div>;
}
