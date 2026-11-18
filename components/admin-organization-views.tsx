"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { errorFields, TextField } from "@/components/admin-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, apiFetchEnvelope, getPagination } from "@/lib/api/client";
import type { Branch, Employee, OrganizationUnit, StoreBranchRequest, StoreReferenceRequest, Tenant, UpdateBranchRequest, UpdateReferenceRequest } from "@/lib/api/types";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { PageHeader } from "@/components/page-header";
import { hasPermission } from "@/lib/permissions";

const OrganizationBranchMap = dynamic(() => import("@/components/organization-branch-map").then((mod) => mod.OrganizationBranchMap), { ssr: false, loading: () => <div className="h-[360px] animate-pulse rounded-xl border bg-muted" /> });

type ReferenceMode = "departments" | "positions" | "groups" | "employment-statuses";
const referenceConfig: Record<ReferenceMode, { title: string; singular: string; permission: string; managePermission: string }> = { departments: { title: "Departemen", singular: "Departemen", permission: "department.view", managePermission: "department.manage" }, positions: { title: "Jabatan", singular: "Jabatan", permission: "position.view", managePermission: "position.manage" }, groups: { title: "Grup Karyawan", singular: "Grup Karyawan", permission: "group.view", managePermission: "group.manage" }, "employment-statuses": { title: "Status Kepegawaian", singular: "Status Kepegawaian", permission: "reference.view", managePermission: "reference.manage" } };

export function AdminOrganizationOverviewView({ tenant, userName, permissions }: { tenant: Tenant; userName: string; permissions: string[] }) {
  const branches = useQuery({ queryKey: ["organization", "branches"], queryFn: () => apiFetch<Branch[]>("organization/branches"), enabled: hasPermission(permissions, "branch.view") });
  const employees = useQuery({ queryKey: ["organization", "employee-count"], queryFn: () => apiFetchEnvelope<Employee[]>("employees?per_page=1&page=1"), enabled: hasPermission(permissions, "employee.view") });
  const users = useQuery({ queryKey: ["organization", "user-count"], queryFn: () => apiFetchEnvelope<unknown[]>("users?per_page=1&page=1"), enabled: hasPermission(permissions, "user.view") });
  const canView = hasPermission(permissions, "branch.view") || hasPermission(permissions, "employee.view") || hasPermission(permissions, "user.view");
  if (!canView) return <UnauthorizedState />;
  const loading = branches.isLoading || employees.isLoading || users.isLoading;
  const employeeCount = getPagination(employees.data?.meta ?? {})?.total;
  const userCount = getPagination(users.data?.meta ?? {})?.total;
  return <div className="space-y-6"><PageHeader eyebrow="Pengaturan · Organisasi" title="Organisasi" description="Konfigurasi tenant dan status langganan." /><Card className="shadow-sm"><CardContent className="flex flex-wrap items-center gap-4 p-5"><div className="flex size-12 items-center justify-center rounded-full bg-blue-100 text-blue-700"><Building2 className="size-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold">{tenant.name}</p><p className="mt-1 text-sm text-muted-foreground">Tenant code: {tenant.code} · {tenant.subdomain}</p></div><Badge variant={tenant.status === "active" ? "secondary" : "outline"}>{tenant.status === "active" ? "Active" : tenant.status}</Badge></CardContent></Card>{loading ? <LoadingState label="Memuat ringkasan organisasi" /> : <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Status Tenant" value={tenant.status === "active" ? "Active" : tenant.status} tone="green" /><Stat label="Zona Waktu" value={tenant.timezone} tone="blue" /><Stat label="Mata Uang" value={tenant.currency} tone="slate" /><Stat label="Owner" value={userName} tone="slate" /></div><div className="grid gap-4 lg:grid-cols-2"><ProfileCard tenant={tenant} /><QuotaCard employees={employeeCount} branches={branches.data?.length} users={userCount} /></div><div className="rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800"><p className="font-medium">Perubahan konfigurasi organisasi dicatat dalam audit log.</p><p className="mt-1 text-xs text-blue-700">Pemilik tenant aktif: {userName} · Status langganan: {tenant.status}</p></div></>}</div>;
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "green" | "blue" | "slate" }) { const colors = { green: "text-emerald-600", blue: "text-blue-600", slate: "text-slate-900" }; return <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-2 text-xl font-semibold ${colors[tone]}`}>{value}</p></CardContent></Card>; }
function ProfileCard({ tenant }: { tenant: Tenant }) { return <Card><CardHeader><CardTitle>Profil Organisasi</CardTitle><p className="text-xs text-muted-foreground">Data umum tenant dan identitas akses.</p></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><ReadOnly label="Nama Organisasi" value={tenant.name} /><ReadOnly label="Tenant Code" value={tenant.code} /><ReadOnly label="Subdomain" value={tenant.subdomain} /><ReadOnly label="Timezone" value={tenant.timezone} /><ReadOnly label="Locale" value={tenant.locale} /><ReadOnly label="Currency" value={tenant.currency} /><p className="text-xs text-amber-700 sm:col-span-2">Tenant code tidak dapat diubah setelah ada data bisnis.</p></CardContent></Card>; }
function ReadOnly({ label, value }: { label: string; value: string }) { return <div><p className="mb-2 text-xs font-medium text-slate-700">{label}</p><div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm text-slate-600">{value}</div></div>; }
function QuotaCard({ employees, branches, users }: { employees?: number; branches?: number; users?: number }) { return <Card><CardHeader><CardTitle>Kuota Tenant</CardTitle><p className="text-xs text-muted-foreground">Pemakaian yang dapat dihitung dari endpoint aktif.</p></CardHeader><CardContent className="space-y-5"><Quota label="Karyawan" value={employees} note="Tanpa limit plan pada contract" /><Quota label="Cabang" value={branches} note="Data cabang aktif" /><Quota label="Admin User" value={users} note="User tenant" /><div><div className="flex justify-between text-sm"><span>Storage</span><span className="text-muted-foreground">Belum tersedia</span></div><div className="mt-2 h-2 rounded-full bg-slate-100" /></div></CardContent></Card>; }
function Quota({ label, value, note }: { label: string; value?: number; note: string }) { return <div><div className="flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground">{value ?? "—"}</span></div><div className="mt-2 h-2 rounded-full bg-slate-100"><div className="h-2 w-1/3 rounded-full bg-blue-600" /></div><p className="mt-1 text-[11px] text-muted-foreground">{note}</p></div>; }

export function AdminOrganizationBranchView({ permissions }: { permissions: string[] }) {
  const queryClient = useQueryClient();
  const canView = hasPermission(permissions, "branch.view");
  const canManage = hasPermission(permissions, "branch.manage");
  const branches = useQuery({ queryKey: ["organization", "branches"], queryFn: () => apiFetch<Branch[]>("organization/branches"), enabled: canView });
  const [selectedId, setSelectedId] = useState<string>();
  const [editor, setEditor] = useState<Branch | "create" | null>(null);
  const [pointInputs, setPointInputs] = useState<{ latitude: string; longitude: string } | null>(null);
  const [radiusInput, setRadiusInput] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedId && branches.data?.[0]) setSelectedId(branches.data[0].id);
  }, [branches.data, selectedId]);
  const selected = branches.data?.find((branch) => branch.id === selectedId) ?? branches.data?.[0];
  const formBranch = editor === "create" ? undefined : editor ?? selected;
  const mapBranch = editor === "create" ? undefined : formBranch;
  const latitude = pointInputs?.latitude ?? String(formBranch?.latitude ?? "");
  const longitude = pointInputs?.longitude ?? String(formBranch?.longitude ?? "");
  const radius = radiusInput ?? String(formBranch?.radius_meters ?? 100);
  const draftPoint = useMemo(() => pointInputs && latitude.trim() && longitude.trim()
    && Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude))
    && Math.abs(Number(latitude)) < 85.051129 && Math.abs(Number(longitude)) <= 180
    ? { latitude: Number(latitude), longitude: Number(longitude) } : null, [pointInputs, latitude, longitude]);
  const branchMutation = useMutation({ mutationFn: ({ branch, payload }: { branch?: Branch; payload: StoreBranchRequest | UpdateBranchRequest }) => branch ? apiFetch<Branch>(`organization/branches/${branch.id}`, { method: "PATCH", body: JSON.stringify(payload) }) : apiFetch<Branch>("organization/branches", { method: "POST", body: JSON.stringify(payload) }), onSuccess: async (branch, variables) => {
    toast.success(variables.branch ? "Cabang berhasil diperbarui" : "Cabang berhasil dibuat");
    setEditor(null);
    setPointInputs(null);
    setRadiusInput(null);
    setSelectedId(branch.id);
    await queryClient.invalidateQueries({ queryKey: ["organization", "branches"] });
  }, onError: (error) => toast.error(getErrorMessage(error)) });
  const remove = useMutation({ mutationFn: (id: string) => apiFetch<null>(`organization/branches/${id}`, { method: "DELETE" }), onSuccess: async (_, id) => {
    toast.success("Cabang berhasil dihapus");
    await queryClient.invalidateQueries({ queryKey: ["organization", "branches"] });
    if (selectedId === id) { setSelectedId(undefined); setEditor(null); setPointInputs(null); setRadiusInput(null); }
  }, onError: (error) => toast.error(getErrorMessage(error)) });
  function selectBranch(branch: Branch) {
    setSelectedId(branch.id);
    setEditor(branch);
    setPointInputs(null);
    setRadiusInput(null);
    branchMutation.reset();
  }
  if (!canView) return <UnauthorizedState />;
  if (branches.isLoading) return <LoadingState label="Memuat cabang" />;
  if (branches.isError) return <ErrorState message={getErrorMessage(branches.error)} retry={() => void branches.refetch()} />;
  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <PageHeader eyebrow="Pengaturan · Organisasi" title="Kelola Cabang" description="Kelola cabang dan pilih lokasi geofence langsung di peta." />
      {canManage ? <Button onClick={() => { setEditor("create"); setPointInputs(null); setRadiusInput(null); branchMutation.reset(); }}><Plus className="mr-2 size-4" />Tambah Cabang</Button> : null}
    </div>
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <Card><CardHeader><CardTitle>Peta Cabang</CardTitle><p className="text-xs text-muted-foreground">{canManage ? "Klik peta untuk memilih titik cabang, atau geser pin biru untuk memperbaiki lokasi. Simpan perubahan pada form." : "Lokasi dan geofence cabang tenant."}</p></CardHeader><CardContent>
        <OrganizationBranchMap branch={mapBranch} branches={branches.data ?? []} editable={canManage} draftPoint={draftPoint} radiusMeters={Number(radius)} onSelect={selectBranch} onPick={(point) => {
          if (!canManage) return;
          setEditor((current) => current ?? selected ?? "create");
          setPointInputs({ latitude: point.latitude.toFixed(6), longitude: point.longitude.toFixed(6) });
          branchMutation.reset();
        }} />
        {draftPoint ? <p role="status" className="mt-4 text-sm text-primary">Titik dipilih: {formatCoordinate(draftPoint.latitude, draftPoint.longitude)} · radius {radius || "—"} m (belum disimpan)</p> : mapBranch ? <p className="mt-4 text-sm text-muted-foreground">{mapBranch.name} · radius {mapBranch.radius_meters} m · {formatCoordinate(mapBranch.latitude, mapBranch.longitude)}</p> : null}
      </CardContent></Card>
      <BranchDataCard key={editor === "create" ? "create" : formBranch?.id ?? "empty"} branch={formBranch} canManage={canManage} pending={branchMutation.isPending} error={branchMutation.error} latitude={latitude} longitude={longitude} radius={radius} onCoordinateChange={(name, value) => setPointInputs({ latitude: name === "latitude" ? value : latitude, longitude: name === "longitude" ? value : longitude })} onRadiusChange={setRadiusInput} onSubmit={(payload) => branchMutation.mutate({ branch: formBranch, payload })} />
    </div>
    <BranchList branches={branches.data ?? []} canManage={canManage} pending={remove.isPending} selectedId={selected?.id} onSelect={selectBranch} onEdit={selectBranch} onDelete={(branch) => { if (window.confirm(`Hapus cabang ${branch.name}?`)) remove.mutate(branch.id); }} />
  </div>;
}

function BranchDataCard({ branch, canManage, pending, error, latitude, longitude, radius, onCoordinateChange, onRadiusChange, onSubmit }: {
  branch?: Branch;
  canManage: boolean;
  pending: boolean;
  error: unknown;
  latitude: string;
  longitude: string;
  radius: string;
  onCoordinateChange: (name: "latitude" | "longitude", value: string) => void;
  onRadiusChange: (value: string) => void;
  onSubmit: (payload: StoreBranchRequest | UpdateBranchRequest) => void;
}) {
  const fields = errorFields(error);
  return <Card><CardHeader><CardTitle>Data Cabang</CardTitle><p className="text-xs text-muted-foreground">Klik peta untuk mengisi koordinat otomatis. Radius geofence 10–5.000 meter.</p></CardHeader><CardContent>
    {canManage ? <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const text = (name: string) => String(form.get(name) ?? "");
      onSubmit({ code: text("code"), name: text("name"), address: text("address") || null, latitude: Number(latitude), longitude: Number(longitude), radius_meters: Number(radius), timezone: text("timezone"), legacy_code: text("legacy_code") || null, is_active: form.get("is_active") === "on" });
    }}>
      {error ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{getErrorMessage(error)}</p> : null}
      <TextField label="Kode Cabang" name="code" required defaultValue={branch?.code ?? ""} error={fields.code} />
      <TextField label="Nama Cabang" name="name" required defaultValue={branch?.name ?? ""} error={fields.name} />
      <div className="sm:col-span-2"><TextField label="Alamat" name="address" defaultValue={branch?.address ?? ""} error={fields.address} /></div>
      <TextField label="Latitude" name="latitude" type="number" step="any" min={-85} max={85} required value={latitude} onChange={(event) => onCoordinateChange("latitude", event.target.value)} error={fields.latitude} />
      <TextField label="Longitude" name="longitude" type="number" step="any" min={-180} max={180} required value={longitude} onChange={(event) => onCoordinateChange("longitude", event.target.value)} error={fields.longitude} />
      <TextField label="Radius Geofence (meter)" name="radius_meters" type="number" min={10} max={5000} required value={radius} onChange={(event) => onRadiusChange(event.target.value)} error={fields.radius_meters} />
      <TextField label="Timezone" name="timezone" required defaultValue={branch?.timezone ?? "Asia/Jakarta"} error={fields.timezone} />
      <TextField label="Kode lama" name="legacy_code" defaultValue={branch?.legacy_code ?? ""} error={fields.legacy_code} />
      <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={branch?.is_active ?? true} />Aktif</label>
      <div className="sm:col-span-2"><Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : branch ? "Simpan perubahan" : "Simpan cabang"}</Button></div>
    </form> : branch ? <div className="grid gap-4 sm:grid-cols-2"><ReadOnly label="Kode Cabang" value={branch.code} /><ReadOnly label="Nama Cabang" value={branch.name} /><ReadOnly label="Alamat" value={branch.address ?? "—"} /><ReadOnly label="Latitude" value={String(branch.latitude)} /><ReadOnly label="Longitude" value={String(branch.longitude)} /><ReadOnly label="Radius Geofence" value={`${branch.radius_meters} meter`} /><ReadOnly label="Timezone" value={branch.timezone} /></div> : <EmptyState title="Belum ada cabang" description="Cabang tenant akan muncul di sini." />}
  </CardContent></Card>;
}
function BranchList({ branches, canManage, pending, selectedId, onSelect, onEdit, onDelete }: { branches: Branch[]; canManage: boolean; pending: boolean; selectedId?: string; onSelect: (branch: Branch) => void; onEdit: (branch: Branch) => void; onDelete: (branch: Branch) => void }) { return <Card><CardHeader><CardTitle>Daftar Cabang</CardTitle><p className="text-xs text-muted-foreground">{branches.length} cabang · branch.view / branch.manage</p></CardHeader><CardContent className="p-0">{!branches.length ? <EmptyState title="Belum ada cabang" description="Tambahkan cabang pertama tenant." /> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-y bg-slate-50 text-left text-xs text-muted-foreground"><th className="px-4 py-3 font-medium">Kode</th><th className="px-4 py-3 font-medium">Nama</th><th className="px-4 py-3 font-medium">Alamat</th><th className="px-4 py-3 font-medium">Radius</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3" /></tr></thead><tbody>{branches.map((branch) => <tr key={branch.id} className={`border-b last:border-0 ${selectedId === branch.id ? "bg-blue-50/60" : ""}`}><td className="px-4 py-4"><button className="font-medium text-left hover:text-primary" onClick={() => onSelect(branch)}>{branch.code}</button></td><td className="px-4 py-4 font-medium">{branch.name}</td><td className="px-4 py-4 text-muted-foreground">{branch.address ?? "—"}</td><td className="px-4 py-4 text-muted-foreground">{branch.radius_meters} m</td><td className="px-4 py-4"><Badge variant={branch.is_active ? "secondary" : "outline"}>{branch.is_active ? "Aktif" : "Nonaktif"}</Badge></td><td className="px-4 py-4"><div className="flex justify-end gap-1">{canManage ? <><Button variant="ghost" size="icon-sm" disabled={pending} onClick={() => onEdit(branch)}><Pencil /></Button><Button variant="ghost" size="icon-sm" disabled={pending} onClick={() => onDelete(branch)}><Trash2 className="text-destructive" /></Button></> : null}</div></td></tr>)}</tbody></table></div>}</CardContent></Card>; }

export function AdminOrganizationReferenceView({ mode, permissions }: { mode: ReferenceMode; permissions: string[] }) {
  const config = referenceConfig[mode];
  const queryClient = useQueryClient();
  const canView = hasPermission(permissions, config.permission);
  const canManage = hasPermission(permissions, config.managePermission);
  const items = useQuery({ queryKey: ["organization", mode], queryFn: () => apiFetch<OrganizationUnit[]>(`organization/${mode}`), enabled: canView });
  const [editor, setEditor] = useState<OrganizationUnit | "create" | null>(null);
  const mutation = useMutation({ mutationFn: ({ item, payload }: { item?: OrganizationUnit; payload: StoreReferenceRequest | UpdateReferenceRequest }) => item ? apiFetch<OrganizationUnit>(`organization/${mode}/${item.id}`, { method: "PATCH", body: JSON.stringify(payload) }) : apiFetch<OrganizationUnit>(`organization/${mode}`, { method: "POST", body: JSON.stringify(payload) }), onSuccess: async () => { toast.success(`${config.singular} berhasil disimpan`); setEditor(null); await queryClient.invalidateQueries({ queryKey: ["organization", mode] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  const remove = useMutation({ mutationFn: (id: string) => apiFetch<null>(`organization/${mode}/${id}`, { method: "DELETE" }), onSuccess: async () => { toast.success(`${config.singular} berhasil dihapus`); await queryClient.invalidateQueries({ queryKey: ["organization", mode] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  if (!canView) return <UnauthorizedState />;
  if (items.isLoading) return <LoadingState label={`Memuat ${config.title.toLowerCase()}`} />;
  if (items.isError) return <ErrorState message={getErrorMessage(items.error)} retry={() => void items.refetch()} />;
  const item = editor === "create" ? undefined : editor ?? undefined;
  return <div className="space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><PageHeader eyebrow="Pengaturan · Organisasi" title={`Kelola ${config.title}`} description={`CRUD referensi ${config.title.toLowerCase()} tenant.`} />{canManage ? <Button onClick={() => setEditor("create")}><Plus className="mr-2 size-4" />Tambah {config.singular}</Button> : null}</div><div className="grid gap-4 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]"><ReferenceForm config={config} item={item} canManage={canManage} pending={mutation.isPending} error={mutation.error} onSubmit={(payload) => mutation.mutate({ item, payload })} /><ReferenceList config={config} items={items.data ?? []} canManage={canManage} pending={remove.isPending} onEdit={(value) => setEditor(value)} onDelete={(value) => { if (window.confirm(`Hapus ${config.singular.toLowerCase()} ${value.name}?`)) remove.mutate(value.id); }} /></div></div>;
}

function ReferenceForm({ config, item, canManage, pending, error, onSubmit }: { config: { title: string; singular: string }; item?: OrganizationUnit; canManage: boolean; pending: boolean; error: unknown; onSubmit: (payload: StoreReferenceRequest | UpdateReferenceRequest) => void }) { const fields = errorFields(error); return <Card><CardHeader><CardTitle>Form {config.singular}</CardTitle><p className="text-xs text-muted-foreground">Kode unik per tenant.</p></CardHeader><CardContent>{canManage ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); onSubmit({ code: String(form.get("code") ?? ""), name: String(form.get("name") ?? ""), legacy_code: String(form.get("legacy_code") ?? "") || null, is_active: form.get("is_active") === "on" }); }}><TextField label={`Kode ${config.singular}`} name="code" required defaultValue={item?.code ?? ""} error={fields.code} /><TextField label={`Nama ${config.singular}`} name="name" required defaultValue={item?.name ?? ""} error={fields.name} /><TextField label="Kode lama" name="legacy_code" defaultValue={item?.legacy_code ?? ""} error={fields.legacy_code} /><label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={item?.is_active ?? true} />Aktif</label><Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : item ? "Simpan perubahan" : "Simpan"}</Button></form> : <EmptyState title="Akses kelola terbatas" description="Anda hanya dapat melihat referensi ini." />}</CardContent></Card>; }
function ReferenceList({ config, items, canManage, pending, onEdit, onDelete }: { config: { title: string }; items: OrganizationUnit[]; canManage: boolean; pending: boolean; onEdit: (item: OrganizationUnit) => void; onDelete: (item: OrganizationUnit) => void }) { return <Card><CardHeader><CardTitle>Daftar {config.title}</CardTitle><p className="text-xs text-muted-foreground">{items.length} data aktif</p></CardHeader><CardContent className="p-0">{!items.length ? <EmptyState title={`Belum ada ${config.title.toLowerCase()}`} description={`${config.title} tenant akan muncul di sini.`} /> : <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-sm"><thead><tr className="border-y bg-slate-50 text-left text-xs text-muted-foreground"><th className="px-4 py-3 font-medium">Kode</th><th className="px-4 py-3 font-medium">Nama</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3" /></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="px-4 py-4 text-muted-foreground">{item.code}</td><td className="px-4 py-4 font-medium">{item.name}</td><td className="px-4 py-4"><Badge variant={item.is_active ? "secondary" : "outline"}>{item.is_active ? "Aktif" : "Nonaktif"}</Badge></td><td className="px-4 py-4"><div className="flex justify-end gap-1">{canManage ? <><Button variant="ghost" size="icon-sm" disabled={pending} onClick={() => onEdit(item)}><Pencil /></Button><Button variant="ghost" size="icon-sm" disabled={pending} onClick={() => onDelete(item)}><Trash2 className="text-destructive" /></Button></> : null}</div></td></tr>)}</tbody></table></div>}</CardContent></Card>; }

function formatCoordinate(latitude: number, longitude: number) { return `${Math.abs(latitude).toFixed(4)}°${latitude < 0 ? "S" : "N"} ${Math.abs(longitude).toFixed(4)}°${longitude < 0 ? "W" : "E"}`; }
