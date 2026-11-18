"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminFormDialog, TextField, errorFields } from "@/components/admin-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiFetch } from "@/lib/api/client";
import type { Permission, Role, StoreRoleRequest } from "@/lib/api/types";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { hasPermission } from "@/lib/permissions";

const roleDescriptions: Record<string, string> = {
  tenant_owner: "Akses penuh tenant",
  tenant_admin: "Administrasi tenant",
  hr_admin: "Karyawan, jadwal, presensi",
  payroll_admin: "Payroll dan slip",
  finance_admin: "Pinjaman dan reimbursement",
  supervisor: "Approval dan data tim",
  employee: "Self-service",
};

function moduleName(permission: string) {
  return permission.split(".")[0] ?? permission;
}

const crudActions = [
  { label: "Lihat", aliases: ["view", "read", "index", "show"] },
  { label: "Buat", aliases: ["create", "store"] },
  { label: "Ubah", aliases: ["update", "edit"] },
  { label: "Hapus", aliases: ["delete", "destroy"] },
] as const;

function crudColumn(permission: Permission): number | null {
  const action = permission.name.split(".").at(-1);
  const column = crudActions.findIndex((item) => (item.aliases as readonly string[]).includes(action ?? ""));
  return column === -1 ? null : column;
}

export function AdminRolesView({ permissions }: { permissions: string[] }) {
  const queryClient = useQueryClient();
  const canView = hasPermission(permissions, "role.view");
  const canManage = hasPermission(permissions, "role.manage");
  const [selectedRoleId, setSelectedRoleId] = useState<string>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);

  const roles = useQuery({ queryKey: ["roles"], queryFn: () => apiFetch<Role[]>("roles"), enabled: canView });
  const permissionQuery = useQuery({ queryKey: ["permissions"], queryFn: () => apiFetch<Permission[]>("permissions"), enabled: canView });
  const selectedRole = roles.data?.find((role) => role.id === selectedRoleId)
    ?? roles.data?.find((role) => role.name === "hr_admin")
    ?? roles.data?.[0];

  useEffect(() => {
    if (selectedRole) {
      setSelectedRoleId(selectedRole.id);
      setDraftPermissions(selectedRole.permissions);
    }
  }, [selectedRole]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["roles"] });
    await queryClient.invalidateQueries({ queryKey: ["users"] });
  };
  const saveRole = useMutation({
    mutationFn: (payload: StoreRoleRequest) => apiFetch<Role>("roles", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async (role) => {
      toast.success("Role berhasil dibuat");
      setDialogOpen(false);
      setSelectedRoleId(role.id);
      await invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (role: Role) => apiFetch<null>(`roles/${role.id}`, { method: "DELETE" }),
    onSuccess: async (_, role) => {
      toast.success("Role berhasil dihapus");
      if (selectedRoleId === role.id) setSelectedRoleId(undefined);
      await invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const sync = useMutation({
    mutationFn: ({ role, selected }: { role: Role; selected: string[] }) => apiFetch<Role>(`roles/${role.id}/permissions`, { method: "PUT", body: JSON.stringify({ permissions: selected }) }),
    onSuccess: async (role) => {
      toast.success("Permission role diperbarui");
      setDraftPermissions(role.permissions);
      await invalidate();
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const permissionGroups = useMemo(() => {
    const grouped = new Map<string, Permission[]>();
    for (const permission of permissionQuery.data ?? []) {
      const group = moduleName(permission.name);
      grouped.set(group, [...(grouped.get(group) ?? []), permission]);
    }
    const search = permissionSearch.trim().toLowerCase();
    return Array.from(grouped.entries())
      .filter(([group, items]) => !search || group.toLowerCase().includes(search) || items.some((item) => item.name.toLowerCase().includes(search)))
      .sort(([a], [b]) => a.localeCompare(b));
  }, [permissionQuery.data, permissionSearch]);

  if (!canView) return <UnauthorizedState />;
  if (roles.isLoading || permissionQuery.isLoading) return <LoadingState label="Memuat role dan katalog permission" />;
  if (roles.isError) return <ErrorState message={getErrorMessage(roles.error)} retry={() => void roles.refetch()} />;
  if (permissionQuery.isError) return <ErrorState message={getErrorMessage(permissionQuery.error)} retry={() => void permissionQuery.refetch()} />;

  const roleList = roles.data ?? [];
  const hasPermissionChanges = selectedRole && (
    draftPermissions.length !== selectedRole.permissions.length
    || draftPermissions.some((permission) => !selectedRole.permissions.includes(permission))
  );

  return <div>
    {!roleList.length ? <EmptyState title="Belum ada role" description="Role tenant akan muncul di sini setelah tersedia." /> : <div className="grid items-start gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="flex min-h-0 flex-col self-start lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)] lg:max-h-[calc(100vh-7rem)]"><CardHeader className="shrink-0 flex-row items-start justify-between gap-3"><div><CardTitle>Role Tenant</CardTitle><p className="mt-1 text-xs text-muted-foreground">Role default dan custom role.</p></div>{canManage ? <Button size="sm" onClick={() => setDialogOpen(true)}><Plus className="mr-2 size-4" />Buat Role</Button> : null}</CardHeader><CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain px-3">
        {roleList.map((role) => <div key={role.id} className="flex items-center gap-1">
          <button type="button" onClick={() => setSelectedRoleId(role.id)} aria-pressed={selectedRole?.id === role.id} className={`min-w-0 flex-1 rounded-lg border p-4 text-left transition-colors ${selectedRole?.id === role.id ? "border-primary/20 bg-accent text-accent-foreground" : "border-transparent hover:border-border hover:bg-muted/50"}`}>
            <span className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{role.name}</span>{role.is_default ? <Badge variant="outline" className="text-[10px]">Default</Badge> : null}</span>
            <span className="mt-1 block text-xs text-muted-foreground">{roleDescriptions[role.name] ?? `${role.permissions.length} permission`}</span>
          </button>
          {canManage && role.name !== "tenant_owner" ? <Button type="button" variant="ghost" size="icon" aria-label={`Hapus role ${role.name}`} title={`Hapus ${role.name}`} disabled={remove.isPending} onClick={() => { if (window.confirm(`Hapus role ${role.name}? Penghapusan dapat ditolak jika role masih digunakan.`)) remove.mutate(role); }}><Trash2 className="size-4 text-destructive" /></Button> : null}
        </div>)}
      </CardContent></Card>

      {selectedRole ? <Card className="min-h-[700px] min-w-0"><CardHeader><div><CardTitle className="text-lg">{selectedRole.name}</CardTitle><p className="mt-1 text-sm text-muted-foreground">{roleDescriptions[selectedRole.name] ?? `${selectedRole.permissions.length} permission terpasang`}</p></div></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm font-semibold">Permission</p><div className="relative w-full sm:w-56"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Cari permission" className="h-9 pl-9" placeholder="Cari permission…" value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} /></div></div>
          {selectedRole.permissions.includes("*") ? <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">Role ini memiliki wildcard <code>*</code> dari konfigurasi tenant.</p> : null}
          {!permissionQuery.data?.length ? <EmptyState title="Katalog permission kosong" description="Permission belum tersedia untuk ditampilkan." /> : permissionGroups.length === 0 ? <EmptyState title="Permission tidak ditemukan" description="Coba kata kunci lain." /> : <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[600px] table-fixed text-sm">
              <colgroup><col className="w-auto" /><col className="w-20" /><col className="w-20" /><col className="w-20" /><col className="w-20" /><col className="w-20" /></colgroup>
              <thead><tr className="border-b bg-background text-xs text-muted-foreground"><th scope="col" className="px-4 py-3 text-left font-semibold">Modul</th>{crudActions.map((action) => <th key={action.label} scope="col" className="px-2 py-3 text-center font-semibold">{action.label}</th>)}<th scope="col" className="px-2 py-3 text-center font-semibold">Lainnya</th></tr></thead>
              <tbody>{permissionGroups.map(([group, items], index) => {
                const crudPermissions = crudActions.map((action) => items.filter((item) => {
                  const column = crudColumn(item);
                  return column !== null && crudActions[column].label === action.label;
                }));
                const specialPermissions = items.filter((item) => crudColumn(item) === null);
                const rowClass = index % 2 === 0 ? "bg-muted/50" : "bg-background";
                const specialNames = specialPermissions.map((permission) => permission.name);
                const selectedSpecialCount = specialNames.filter((name) => draftPermissions.includes(name)).length;
                const specialChecked = selectedRole.permissions.includes("*") || (specialNames.length > 0 && selectedSpecialCount === specialNames.length);
                const specialPartiallyChecked = !selectedRole.permissions.includes("*") && selectedSpecialCount > 0 && selectedSpecialCount < specialNames.length;
                return <tr key={group} className={`${rowClass} border-b last:border-0`}>
                    <th scope="row" className="px-4 py-3 text-left text-xs font-semibold capitalize text-foreground">{group.replaceAll("_", " ")}</th>
                    {crudPermissions.map((cellPermissions, cell) => {
                      if (!cellPermissions.length) return <td key={cell} className="px-2 py-2 text-center text-muted-foreground">—</td>;
                      const names = cellPermissions.map((item) => item.name);
                      const selectedCount = names.filter((name) => draftPermissions.includes(name)).length;
                      const checked = selectedRole.permissions.includes("*") || selectedCount === names.length;
                      const partiallyChecked = !selectedRole.permissions.includes("*") && selectedCount > 0 && selectedCount < names.length;
                      return <td key={cell} className="px-2 py-2 text-center"><input ref={(element) => { if (element) element.indeterminate = partiallyChecked; }} aria-label={`${checked ? "Cabut" : "Beri"} ${crudActions[cell].label.toLowerCase()} · ${names.join(", ")}`} title={names.join(", ")} className="size-5 cursor-pointer accent-blue-600 disabled:cursor-not-allowed" type="checkbox" checked={checked} disabled={!canManage || selectedRole.permissions.includes("*") || sync.isPending} onChange={() => setDraftPermissions((current) => checked ? current.filter((name) => !names.includes(name)) : Array.from(new Set([...current, ...names])))} /></td>;
                    })}
                    <td className="px-2 py-2 text-center">{specialNames.length ? <input ref={(element) => { if (element) element.indeterminate = specialPartiallyChecked; }} aria-label={`${specialChecked ? "Cabut" : "Beri"} permission lainnya · ${specialNames.join(", ")}`} title={specialNames.join(", ")} className="size-5 cursor-pointer accent-blue-600 disabled:cursor-not-allowed" type="checkbox" checked={specialChecked} disabled={!canManage || selectedRole.permissions.includes("*") || sync.isPending} onChange={() => setDraftPermissions((current) => specialChecked ? current.filter((name) => !specialNames.includes(name)) : Array.from(new Set([...current, ...specialNames])))} /> : <span className="text-muted-foreground">—</span>}</td>
                  </tr>;
              })}</tbody>
            </table>
          </div>}
          <div className="flex flex-col-reverse gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs text-muted-foreground">Perubahan role dan permission dicatat dalam audit log.</p>{canManage ? <Button disabled={!hasPermissionChanges || sync.isPending || !permissionQuery.data?.length || selectedRole.permissions.includes("*")} onClick={() => sync.mutate({ role: selectedRole, selected: draftPermissions })}>{sync.isPending ? "Menyimpan..." : <><Check className="mr-2 size-4" />Simpan Perubahan</>}</Button> : null}</div>
        </CardContent>
      </Card> : null}
    </div>}

    {dialogOpen ? <RoleDialog open pending={saveRole.isPending} error={saveRole.error} onClose={() => setDialogOpen(false)} onSubmit={(payload) => saveRole.mutate(payload)} /> : null}
  </div>;
}

function RoleDialog({ open, pending, error, onClose, onSubmit }: { open: boolean; pending: boolean; error: unknown; onClose: () => void; onSubmit: (payload: StoreRoleRequest) => void }) {
  const fields = errorFields(error);
  return <AdminFormDialog open={open} title="Buat Role" description="Buat role terlebih dahulu, lalu atur permission melalui tabel." pending={pending} onClose={onClose} onSubmit={(event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    onSubmit({ name, permissions: [] });
  }}>
    <TextField label="Nama Role" name="name" required maxLength={50} error={fields.name} />
  </AdminFormDialog>;
}
