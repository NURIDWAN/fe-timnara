"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, ShieldCheck, Trash2, UserCheck, UserX } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AdminFormDialog, FormField, TextField, errorFields } from "@/components/admin-form";
import { apiFetch, apiFetchEnvelope, getPagination } from "@/lib/api/client";
import type { Employee, ListResult, Member, Pagination, Role, StoreUserRequest, UpdateUserRequest } from "@/lib/api/types";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { PageHeader } from "@/components/page-header";
import { hasPermission } from "@/lib/permissions";

export function AdminUsersView({ permissions }: { permissions: string[] }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "invited" | "suspended">("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [dialog, setDialog] = useState<{ mode: "edit"; user: Member } | null>(null);
  const canView = hasPermission(permissions, "user.view");
  const canCreate = hasPermission(permissions, "user.create");
  const canUpdate = hasPermission(permissions, "user.update");
  const canDelete = hasPermission(permissions, "user.delete");
  const canManageRoles = hasPermission(permissions, "role.manage");
  const canViewRoles = hasPermission(permissions, "role.view");
  const canViewEmployees = hasPermission(permissions, "employee.view");
  const users = useQuery({
    queryKey: ["users", query, status],
    queryFn: async () => {
      const suffix = query ? `&search=${encodeURIComponent(query)}` : "";
      const statusSuffix = status === "all" ? "" : `&status=${status}`;
      const response = await apiFetchEnvelope<Member[]>(`users?page=1&per_page=100${suffix}${statusSuffix}`);
      return { items: response.data ?? [], pagination: getPagination(response.meta) } satisfies ListResult<Member>;
    },
    enabled: canView,
  });
  const userCounts = useQuery({
    queryKey: ["users", "page-09-counts"],
    queryFn: async (): Promise<{ total: number; active: number; invited: number; suspended: number }> => {
      const statuses = ["active", "invited", "suspended"] as const;
      const [all, ...responses] = await Promise.all([apiFetchEnvelope<Member[]>("users?page=1&per_page=1"), ...statuses.map((value) => apiFetchEnvelope<Member[]>(`users?page=1&per_page=1&status=${value}`))]);
      return {
        total: getPagination(all.meta)?.total ?? 0,
        active: getPagination(responses[0].meta)?.total ?? 0,
        invited: getPagination(responses[1].meta)?.total ?? 0,
        suspended: getPagination(responses[2].meta)?.total ?? 0,
      };
    },
    enabled: canView,
  });
  const roles = useQuery({ queryKey: ["roles"], queryFn: () => apiFetch<Role[]>("roles"), enabled: canViewRoles });
  const employees = useQuery({ queryKey: ["employees", "user-form"], queryFn: () => apiFetch<Employee[]>("employees?per_page=100"), enabled: (canCreate || canUpdate) && canViewEmployees });
  const invalidate = async () => { await queryClient.invalidateQueries({ queryKey: ["users"] }); await queryClient.invalidateQueries({ queryKey: ["me"] }); };
  const mutation = useMutation({
    mutationFn: async ({ user, payload }: { user: Member; payload: UpdateUserRequest }) => apiFetch<Member>(`users/${user.id}`, { method: "PATCH", body: JSON.stringify(payload) }),
    onSuccess: async () => { toast.success("Pengguna berhasil diperbarui"); setDialog(null); await invalidate(); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const action = useMutation({
    mutationFn: async ({ type, user }: { type: "delete" | "suspend" | "activate"; user: Member }) => {
      if (type === "delete") return apiFetch<null>(`users/${user.id}`, { method: "DELETE" });
      return apiFetch<Member>(`users/${user.id}/${type}`, { method: "POST" });
    },
    onSuccess: async (_, variables) => { toast.success(variables.type === "delete" ? "Pengguna berhasil dihapus" : variables.type === "suspend" ? "Pengguna ditangguhkan" : "Pengguna diaktifkan"); await invalidate(); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const syncRoles = useMutation({
    mutationFn: ({ user, roles: selected }: { user: Member; roles: string[] }) => apiFetch<Member>(`users/${user.id}/roles`, { method: "POST", body: JSON.stringify({ roles: selected }) }),
    onSuccess: async () => { toast.success("Role pengguna diperbarui"); await invalidate(); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!canView) return <UnauthorizedState />;
  const filteredUsers = (users.data?.items ?? []).filter((user) => roleFilter === "all" || user.roles.includes(roleFilter));
  const activeCount = userCounts.data?.active;
  const invitedCount = userCounts.data?.invited;
  const suspendedCount = userCounts.data?.suspended;
  const totalCount = (activeCount ?? 0) + (invitedCount ?? 0) + (suspendedCount ?? 0);
  const statusCards = [
    { label: "Total Pengguna", value: userCounts.data?.total ?? (userCounts.isLoading ? "—" : totalCount), color: "text-primary", key: "all" as const },
    { label: "Aktif", value: activeCount ?? "—", color: "text-emerald-600", key: "active" as const },
    { label: "Diundang", value: invitedCount ?? "—", color: "text-amber-600", key: "invited" as const },
    { label: "Suspended", value: suspendedCount ?? "—", color: "text-red-600", key: "suspended" as const },
  ];
  return <div className="space-y-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><PageHeader eyebrow="Pengaturan · Akses" title="Pengguna Tenant" description="Membership, undangan, dan akses pengguna pada tenant aktif." />{canCreate ? <Button asChild><Link href="/admin/users/new"><Plus className="mr-2 size-4" />Undang Pengguna</Link></Button> : null}</div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{statusCards.map((item) => <button key={item.key} type="button" onClick={() => setStatus(item.key)} className={`rounded-xl border bg-card p-4 text-left shadow-sm transition-colors hover:border-primary/40 ${status === item.key ? "border-primary/50 ring-1 ring-primary/20" : ""}`} aria-pressed={status === item.key}><span className="text-xs text-muted-foreground">{item.label}</span><span className={`mt-2 block text-2xl font-bold ${item.color}`}>{item.value}</span></button>)}</div>
    <Card><CardContent className="p-3"><form className="flex flex-col gap-3 md:flex-row md:items-center" onSubmit={(event) => { event.preventDefault(); setQuery(search.trim()); }}><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="bg-muted/40 pl-9" placeholder="Cari nama, email, atau username…" value={search} onChange={(event) => setSearch(event.target.value)} /></div><label className="flex items-center gap-2 text-sm text-muted-foreground"><span>Status:</span><select aria-label="Filter berdasarkan status" className="h-9 rounded-md border bg-background px-2 text-foreground" value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="all">Semua</option><option value="active">Aktif</option><option value="invited">Diundang</option><option value="suspended">Suspended</option></select></label><label className="flex items-center gap-2 text-sm text-muted-foreground"><span>Role:</span><select aria-label="Filter berdasarkan role" className="h-9 max-w-48 rounded-md border bg-background px-2 text-foreground" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option value="all">Semua role</option>{(roles.data ?? []).map((role) => <option key={role.id} value={role.name}>{role.name}</option>)}</select></label><Button type="submit" variant="secondary"><Search className="mr-2 size-4" />Cari</Button></form></CardContent></Card>
    <Card><CardContent className="p-0">{users.isLoading ? <div className="p-6"><LoadingState label="Memuat pengguna tenant" /></div> : users.isError ? <div className="p-6"><ErrorState message={getErrorMessage(users.error)} retry={() => void users.refetch()} /></div> : filteredUsers.length === 0 ? <EmptyState title="Tidak ada pengguna" description="Coba ubah pencarian atau filter status dan role." /> : <UserTable users={filteredUsers} pagination={users.data?.pagination} canUpdate={canUpdate} canDelete={canDelete} canManageRoles={canManageRoles} pending={action.isPending || syncRoles.isPending} onEdit={(user) => setDialog({ mode: "edit", user })} onAction={(type, user) => { if (window.confirm(type === "delete" ? `Hapus ${user.name} dari tenant?` : type === "suspend" ? `Tangguhkan ${user.name}?` : `Aktifkan ${user.name}?`)) action.mutate({ type, user }); }} onSyncRoles={(user, selected) => syncRoles.mutate({ user, roles: selected })} />}</CardContent></Card>
    {dialog ? <UserDialog open mode="edit" user={dialog.user} roles={roles.data ?? []} employees={employees.data ?? []} pending={mutation.isPending} error={mutation.error} onClose={() => setDialog(null)} onSubmit={(payload) => mutation.mutate({ user: dialog.user, payload: payload as UpdateUserRequest })} /> : null}
  </div>;
}

function UserTable({ users, pagination, canUpdate, canDelete, canManageRoles, pending, onEdit, onAction, onSyncRoles }: { users: Member[]; pagination?: Pagination; canUpdate: boolean; canDelete: boolean; canManageRoles: boolean; pending: boolean; onEdit: (user: Member) => void; onAction: (type: "delete" | "suspend" | "activate", user: Member) => void; onSyncRoles: (user: Member, roles: string[]) => void }) {
  const membershipLabel: Record<Member["membership"]["status"], string> = { active: "Aktif", invited: "Diundang", suspended: "Suspended", removed: "Dihapus" };
  const membershipVariant: Record<Member["membership"]["status"], "secondary" | "outline" | "destructive"> = { active: "secondary", invited: "outline", suspended: "destructive", removed: "outline" };
  return <div className="space-y-4">
    <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-sm"><thead><tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground"><th className="px-4 py-3 font-medium">Pengguna</th><th className="px-4 py-3 font-medium">Username / Email</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Membership</th><th className="px-4 py-3 font-medium">Login Terakhir</th><th className="px-4 py-3 text-right font-medium">Aksi</th></tr></thead><tbody>{users.map((user) => <tr key={user.id} className="border-b last:border-0 hover:bg-muted/30"><td className="px-4 py-4 font-medium">{user.name}</td><td className="px-4 py-4 text-muted-foreground"><span>{user.username}</span>{user.email ? <span> · {user.email}</span> : null}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-1">{user.roles.length ? user.roles.map((role) => <Badge key={role} variant="outline">{role}</Badge>) : <span className="text-muted-foreground">—</span>}</div></td><td className="px-4 py-4"><Badge variant={membershipVariant[user.membership.status]}>{membershipLabel[user.membership.status]}</Badge></td><td className="px-4 py-4 text-muted-foreground">{user.last_login_at ? new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(user.last_login_at)) : "—"}</td><td className="px-4 py-4"><div className="flex justify-end gap-1">{canUpdate ? <Button variant="ghost" size="icon-sm" title="Edit pengguna" onClick={() => onEdit(user)}><Pencil /></Button> : null}{canManageRoles ? <RoleEditor user={user} disabled={pending} onSave={(roles) => onSyncRoles(user, roles)} /> : null}{canUpdate && user.membership.status !== "removed" ? <Button variant="ghost" size="icon-sm" title={user.membership.status === "suspended" ? "Aktifkan" : "Tangguhkan"} disabled={pending} onClick={() => onAction(user.membership.status === "suspended" ? "activate" : "suspend", user)}>{user.membership.status === "suspended" ? <UserCheck /> : <UserX />}</Button> : null}{canDelete && user.membership.status !== "removed" ? <Button variant="ghost" size="icon-sm" title="Hapus pengguna" disabled={pending} onClick={() => onAction("delete", user)}><Trash2 className="text-destructive" /></Button> : null}</div></td></tr>)}</tbody></table></div>
    {pagination ? <p className="px-4 pb-4 text-xs text-muted-foreground">Menampilkan {pagination.from ?? 0}–{pagination.to ?? users.length} dari {pagination.total} pengguna tenant · Semua perubahan role dicatat dalam audit log.</p> : null}
  </div>;
}

function RoleEditor({ user, disabled, onSave }: { user: Member; disabled: boolean; onSave: (roles: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(user.roles.join(", "));
  return <><Button variant="ghost" size="icon-sm" title="Kelola role" disabled={disabled} onClick={() => { setValue(user.roles.join(", ")); setOpen(true); }}><ShieldCheck /></Button>{open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4"><div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-xl"><h2 className="font-semibold">Role pengguna</h2><p className="mt-1 text-sm text-muted-foreground">Masukkan nama role dipisahkan koma.</p><Input className="mt-4" value={value} onChange={(event) => setValue(event.target.value)} /><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={() => { onSave(value.split(",").map((role) => role.trim()).filter(Boolean)); setOpen(false); }}>Simpan</Button></div></div></div> : null}</>;
}

function UserDialog({ open, mode, user, roles, employees, pending, error, onClose, onSubmit }: { open: boolean; mode: "create" | "edit"; user?: Member; roles: Role[]; employees: Employee[]; pending: boolean; error: unknown; onClose: () => void; onSubmit: (payload: StoreUserRequest | UpdateUserRequest) => void }) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  useEffect(() => setSelectedRoles(user?.roles ?? (roles.some((role) => role.name === "employee") ? ["employee"] : [])), [user, roles, open]);
  const fields = errorFields(error);
  return <AdminFormDialog open={open} title={mode === "create" ? "Tambah pengguna" : "Edit pengguna"} description="Payload mengikuti StoreUserRequest dan UpdateUserRequest." pending={pending} onClose={onClose} onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const common = { name: String(form.get("name") ?? ""), email: String(form.get("email") ?? "") || null, phone: String(form.get("phone") ?? "") || null, employee_id: String(form.get("employee_id") ?? "") || null }; if (mode === "create") onSubmit({ ...common, username: String(form.get("username") ?? ""), password: String(form.get("password") ?? ""), roles: selectedRoles.length ? selectedRoles : undefined }); else onSubmit(common); }}><div className="grid gap-4 sm:grid-cols-2"><TextField label="Nama" name="name" required defaultValue={user?.name ?? ""} error={fields.name} /><TextField label="Username" name="username" required={mode === "create"} defaultValue={user?.username ?? ""} disabled={mode === "edit"} error={fields.username} /><TextField label="Email" name="email" type="email" defaultValue={user?.email ?? ""} error={fields.email} /><TextField label="Telepon" name="phone" defaultValue={user?.phone ?? ""} error={fields.phone} />{mode === "create" ? <TextField label="Password" name="password" type="password" required minLength={8} error={fields.password} /> : null}<FormField label="Karyawan"><select name="employee_id" defaultValue={user?.employee_id ?? ""} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"><option value="">Tidak dihubungkan</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.employee_number} · {employee.full_name}</option>)}</select></FormField></div>{mode === "create" ? <FormField label="Role"><div className="flex flex-wrap gap-3">{roles.map((role) => <label key={role.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selectedRoles.includes(role.name)} onChange={(event) => setSelectedRoles((current) => event.target.checked ? [...current, role.name] : current.filter((item) => item !== role.name))} />{role.name}</label>)}</div></FormField> : null}</AdminFormDialog>;
}
