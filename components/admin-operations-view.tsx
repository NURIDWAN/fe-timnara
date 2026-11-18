"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { PageHeader } from "@/components/page-header";
import { EmployeeSelect, Field, formatDate, formatDateTime, useEmployeeList } from "@/components/payroll/payroll-shared";
import { Phase6Navigation } from "@/components/phase6-navigation";
import { apiFetch, apiFetchEnvelope, getPagination } from "@/lib/api/client";
import type { Activity, Announcement, AnnouncementRead, Employee, LmsMaterial, LmsRead, StoreAnnouncementRequest, StoreLmsMaterialRequest, StoreViolationRequest, StoreViolationTypeRequest, Violation, ViolationType, Visit, VisitTarget } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";
import { useUrlQueryState } from "@/lib/use-url-query-state";

export type OperationsView = "visits" | "activities" | "violations" | "announcements" | "lms";

const viewDetails: Record<OperationsView, { title: string; description: string; permission: string | string[] }> = {
  visits: { title: "Kunjungan", description: "Pantau kunjungan lapangan, pencapaian, dan target per karyawan.", permission: "visit.view" },
  activities: { title: "Aktivitas", description: "Tinjau aktivitas harian dan verifikasi laporan tim.", permission: "activity.view" },
  violations: { title: "Pelanggaran", description: "Kelola catatan disiplin dan surat peringatan dengan histori yang terlacak.", permission: "violation.view" },
  announcements: { title: "Pengumuman", description: "Buat komunikasi tenant dan pantau pembacaan oleh karyawan.", permission: ["announcement.view", "announcement.manage"] },
  lms: { title: "Pembelajaran", description: "Terbitkan materi pembelajaran dan pantau penyelesaian wajib.", permission: ["lms.view", "lms.manage"] },
};

function canAccess(permissions: string[], required: string | string[]): boolean {
  return Array.isArray(required)
    ? required.some((permission) => hasPermission(permissions, permission))
    : hasPermission(permissions, required);
}

export function AdminOperationsView({ view, permissions }: { view: OperationsView; permissions: string[] }) {
  if (!canAccess(permissions, viewDetails[view].permission)) return <UnauthorizedState />;
  return <div className="flex flex-col gap-5"><PageHeader eyebrow="Operasional" title={viewDetails[view].title} description={viewDetails[view].description} /><Phase6Navigation permissions={permissions} />{view === "visits" ? <VisitsView permissions={permissions} /> : view === "activities" ? <ActivitiesView permissions={permissions} /> : view === "violations" ? <ViolationsView permissions={permissions} /> : view === "announcements" ? <AnnouncementsView permissions={permissions} /> : <LmsView permissions={permissions} />}</div>;
}

function VisitsView({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const { values, update } = useUrlQueryState();
  const page = Math.max(1, Number(values.get("page") ?? "1") || 1);
  const status = values.get("status") ?? "";
  const dateFrom = values.get("date_from") ?? "";
  const dateTo = values.get("date_to") ?? "";
  const canManageTargets = hasPermission(permissions, "visit.manage");
  const employees = useEmployeeList(canManageTargets && hasPermission(permissions, "employee.view"));
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const params = new URLSearchParams({ page: String(page), per_page: "25" });
  if (status) params.set("status", status);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const summaryParams = new URLSearchParams();
  if (dateFrom) summaryParams.set("date_from", dateFrom);
  if (dateTo) summaryParams.set("date_to", dateTo);
  const visits = useQuery({ queryKey: ["operations", "visits", status, dateFrom, dateTo, page], queryFn: () => apiFetchEnvelope<Visit[]>(`visits?${params}`) });
  const summary = useQuery({ queryKey: ["operations", "visits-summary", dateFrom, dateTo], queryFn: () => apiFetchEnvelope<{ total: number; planned: number; in_progress: number; completed: number; cancelled: number; completion_rate: number }>(`visits/summary?${summaryParams}`) });
  const targets = useQuery({ queryKey: ["operations", "visit-targets", year, month], queryFn: () => apiFetchEnvelope<VisitTarget[]>(`visits/targets?period_year=${year}&period_month=${month}`) });
  const saveTarget = useMutation({
    mutationFn: (data: { employee_id: string; target_count: number }) => apiFetch<VisitTarget[]>("visits/targets", { method: "PUT", body: JSON.stringify({ entries: [{ ...data, period_year: year, period_month: month }] }) }),
    onSuccess: async () => { toast.success("Target kunjungan diperbarui"); await client.invalidateQueries({ queryKey: ["operations", "visit-targets"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  if (visits.isLoading || summary.isLoading || targets.isLoading) return <LoadingState label="Memuat data kunjungan" />;
  if (visits.isError) return <ErrorState message={getErrorMessage(visits.error)} retry={() => void visits.refetch()} />;
  if (summary.isError) return <ErrorState message={getErrorMessage(summary.error)} retry={() => void summary.refetch()} />;
  if (canManageTargets && targets.isError) return <ErrorState message={getErrorMessage(targets.error)} retry={() => void targets.refetch()} />;
  const totals = summary.data?.data;
  const rows = visits.data?.data ?? [];
  const pagination = getPagination(visits.data?.meta ?? {});
  return <div className="flex flex-col gap-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Total", totals?.total], ["Direncanakan", totals?.planned], ["Berlangsung", totals?.in_progress], ["Selesai", totals?.completed]].map(([label, value]) => <Card key={String(label)}><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value ?? 0}</p></CardContent></Card>)}</div>
    <Card><CardHeader><CardTitle>Filter kunjungan</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Status"><select aria-label="Filter status kunjungan" className="h-10 rounded-lg border bg-background px-3 text-sm" value={status} onChange={(event) => update({ status: event.target.value, page: "1" })}><option value="">Semua status</option>{["planned", "in_progress", "completed", "cancelled"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></Field><Field label="Dari tanggal"><Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => update({ date_from: event.target.value, page: "1" })} /></Field><Field label="Sampai tanggal"><Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => update({ date_to: event.target.value, page: "1" })} /></Field><div className="flex items-end"><Button variant="outline" onClick={() => update({ status: null, date_from: null, date_to: null, page: null })}>Reset filter</Button></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Daftar kunjungan</CardTitle><CardDescription>{pagination?.total ?? rows.length} kunjungan · tingkat penyelesaian {totals?.completion_rate ?? 0}%</CardDescription></CardHeader><CardContent>{rows.length === 0 ? <EmptyState title="Belum ada kunjungan" description="Kunjungan karyawan akan muncul di sini setelah dicatat." /> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3 pr-4">Tanggal</th><th className="py-3 pr-4">Karyawan</th><th className="py-3 pr-4">Tujuan</th><th className="py-3 pr-4">Pelanggan</th><th className="py-3">Status</th></tr></thead><tbody className="divide-y">{rows.map((visit) => <tr key={visit.id}><td className="py-3 pr-4">{formatDate(visit.visit_date)}</td><td className="py-3 pr-4">{visit.employee_name ?? visit.employee_id}</td><td className="py-3 pr-4 font-medium">{visit.purpose}</td><td className="py-3 pr-4">{visit.customer_name ?? "—"}</td><td className="py-3"><Badge variant={visit.status === "completed" ? "secondary" : "outline"}>{statusLabel(visit.status)}</Badge></td></tr>)}</tbody></table></div>}{pagination && pagination.last_page > 1 ? <Pager page={page} lastPage={pagination.last_page} onPage={(next) => update({ page: String(next) })} /> : null}</CardContent></Card>
    {canManageTargets ? <Card><CardHeader><CardTitle>Target kunjungan bulan ini</CardTitle><CardDescription>Periode {month}/{year}. Target disimpan per karyawan.</CardDescription></CardHeader><CardContent><TargetForm employees={employees.data?.data ?? []} targets={targets.data?.data ?? []} pending={saveTarget.isPending} onSubmit={(data) => saveTarget.mutate(data)} canChooseEmployee={hasPermission(permissions, "employee.view")} /></CardContent></Card> : null}
  </div>;
}

function TargetForm({ employees, targets, pending, onSubmit, canChooseEmployee }: { employees: Employee[]; targets: VisitTarget[]; pending: boolean; onSubmit: (data: { employee_id: string; target_count: number }) => void; canChooseEmployee: boolean }) {
  const [employeeId, setEmployeeId] = useState("");
  const [targetCount, setTargetCount] = useState("");
  const current = targets.find((target) => target.employee_id === employeeId);
  return <form className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end" onSubmit={(event) => { event.preventDefault(); if (employeeId && Number(targetCount) > 0) onSubmit({ employee_id: employeeId, target_count: Number(targetCount) }); }}><Field label="Karyawan">{canChooseEmployee ? <EmployeeSelect employees={employees} value={employeeId} onChange={setEmployeeId} required /> : <Input aria-label="ID karyawan" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required placeholder="ULID karyawan" />}</Field><Field label="Target kunjungan"><Input type="number" min="1" max="10000" value={targetCount || (current ? String(current.target_count) : "")} onChange={(event) => setTargetCount(event.target.value)} required /></Field><Button disabled={pending || !employeeId}>{pending ? "Menyimpan…" : "Simpan target"}</Button><p className="text-xs text-muted-foreground sm:col-span-3">Pencapaian saat ini: {current?.achieved_count ?? 0} kunjungan.</p></form>;
}

function ActivitiesView({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const { values, update } = useUrlQueryState();
  const page = Math.max(1, Number(values.get("page") ?? "1") || 1);
  const status = values.get("status") ?? "";
  const category = values.get("category") ?? "";
  const dateFrom = values.get("date_from") ?? "";
  const dateTo = values.get("date_to") ?? "";
  const params = new URLSearchParams({ page: String(page), per_page: "25" });
  for (const [key, value] of Object.entries({ status, category, date_from: dateFrom, date_to: dateTo })) if (value) params.set(key, value);
  const activities = useQuery({ queryKey: ["operations", "activities", status, category, dateFrom, dateTo, page], queryFn: () => apiFetchEnvelope<Activity[]>(`activities?${params}`) });
  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "verify" | "reject" }) => apiFetch<Activity>(`activities/${id}/${action}`, { method: "POST" }),
    onSuccess: async (_, variables) => { toast.success(variables.action === "verify" ? "Aktivitas diverifikasi" : "Aktivitas ditolak"); await client.invalidateQueries({ queryKey: ["operations", "activities"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  if (activities.isLoading) return <LoadingState label="Memuat aktivitas" />;
  if (activities.isError) return <ErrorState message={getErrorMessage(activities.error)} retry={() => void activities.refetch()} />;
  const rows = activities.data?.data ?? [];
  const pagination = getPagination(activities.data?.meta ?? {});
  return <Card><CardHeader><CardTitle>Log aktivitas</CardTitle><CardDescription>{pagination?.total ?? rows.length} aktivitas ditemukan. Tim yang terlihat mengikuti scope supervisor dari API.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Field label="Status"><select aria-label="Filter status aktivitas" className="h-10 rounded-lg border bg-background px-3 text-sm" value={status} onChange={(event) => update({ status: event.target.value, page: "1" })}><option value="">Semua status</option>{["submitted", "verified", "rejected"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></Field><Field label="Kategori"><Input value={category} onChange={(event) => update({ category: event.target.value, page: "1" })} placeholder="Mis. sales" /></Field><Field label="Dari tanggal"><Input type="date" value={dateFrom} onChange={(event) => update({ date_from: event.target.value, page: "1" })} /></Field><Field label="Sampai tanggal"><Input type="date" value={dateTo} onChange={(event) => update({ date_to: event.target.value, page: "1" })} /></Field></div>{rows.length === 0 ? <EmptyState title="Belum ada aktivitas" description="Laporan aktivitas yang dikirim karyawan akan tampil di sini." /> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3 pr-4">Waktu</th><th className="py-3 pr-4">Karyawan</th><th className="py-3 pr-4">Aktivitas</th><th className="py-3 pr-4">Durasi</th><th className="py-3 pr-4">Status</th><th className="py-3">Tindakan</th></tr></thead><tbody className="divide-y">{rows.map((item) => <tr key={item.id}><td className="py-3 pr-4">{formatDate(item.activity_date)} · {item.activity_time}</td><td className="py-3 pr-4">{item.employee_name ?? item.employee_id}</td><td className="py-3 pr-4"><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.category} · {item.description}</p></td><td className="py-3 pr-4">{item.duration_minutes ? `${item.duration_minutes} menit` : "—"}</td><td className="py-3 pr-4"><Badge variant={item.status === "verified" ? "secondary" : "outline"}>{statusLabel(item.status)}</Badge></td><td className="py-3">{item.status === "submitted" && hasPermission(permissions, "activity.verify") ? <div className="flex gap-2"><Button size="sm" disabled={review.isPending} onClick={() => review.mutate({ id: item.id, action: "verify" })}>Verifikasi</Button><Button size="sm" variant="outline" disabled={review.isPending} onClick={() => review.mutate({ id: item.id, action: "reject" })}>Tolak</Button></div> : "—"}</td></tr>)}</tbody></table></div>}{pagination && pagination.last_page > 1 ? <Pager page={page} lastPage={pagination.last_page} onPage={(next) => update({ page: String(next) })} /> : null}</CardContent></Card>;
}

function ViolationsView({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const { values, update } = useUrlQueryState();
  const page = Math.max(1, Number(values.get("page") ?? "1") || 1);
  const status = values.get("status") ?? "";
  const dateFrom = values.get("date_from") ?? "";
  const dateTo = values.get("date_to") ?? "";
  const canManage = hasPermission(permissions, "violation.manage");
  const canIssue = hasPermission(permissions, "violation.issue");
  const employees = useEmployeeList(canManage && hasPermission(permissions, "employee.view"));
  const params = new URLSearchParams({ page: String(page), per_page: "25" });
  if (status) params.set("status", status);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const violations = useQuery({ queryKey: ["operations", "violations", status, dateFrom, dateTo, page], queryFn: () => apiFetchEnvelope<Violation[]>(`violations?${params}`) });
  const types = useQuery({ queryKey: ["operations", "violation-types"], queryFn: () => apiFetchEnvelope<ViolationType[]>("violations/types") });
  const create = useMutation({
    mutationFn: (payload: StoreViolationRequest) => apiFetch<Violation>("violations", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async () => { toast.success("Pelanggaran disimpan sebagai draft"); await client.invalidateQueries({ queryKey: ["operations", "violations"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const action = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "issue" | "revoke" }) => apiFetch<Violation>(`violations/${id}/${verb}`, { method: "POST" }),
    onSuccess: async (_, variables) => { toast.success(variables.verb === "issue" ? "Surat peringatan diterbitkan" : "Surat peringatan dicabut"); await client.invalidateQueries({ queryKey: ["operations", "violations"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  if (violations.isLoading || types.isLoading) return <LoadingState label="Memuat pelanggaran" />;
  if (violations.isError) return <ErrorState message={getErrorMessage(violations.error)} retry={() => void violations.refetch()} />;
  if (types.isError) return <ErrorState message={getErrorMessage(types.error)} retry={() => void types.refetch()} />;
  const rows = violations.data?.data ?? [];
  const pagination = getPagination(violations.data?.meta ?? {});
  return <div className="flex flex-col gap-4">{canManage ? <Card><CardHeader><CardTitle>Catat pelanggaran</CardTitle><CardDescription>Pelanggaran dibuat sebagai draft. Kategori berat mungkin memerlukan approval sebelum diterbitkan.</CardDescription></CardHeader><CardContent><ViolationForm employees={employees.data?.data ?? []} types={types.data?.data ?? []} canChooseEmployee={hasPermission(permissions, "employee.view")} pending={create.isPending} onSubmit={(payload) => create.mutate(payload)} /></CardContent></Card> : null}<Card><CardHeader><CardTitle>Riwayat pelanggaran</CardTitle><CardDescription>{pagination?.total ?? rows.length} catatan. Status kedaluwarsa tetap tersedia sebagai histori.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-3"><Field label="Status"><select aria-label="Filter status pelanggaran" className="h-10 rounded-lg border bg-background px-3 text-sm" value={status} onChange={(event) => update({ status: event.target.value, page: "1" })}><option value="">Semua status</option>{["draft", "issued", "acknowledged", "appealed", "revoked", "expired"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></Field><Field label="Dari tanggal"><Input type="date" value={dateFrom} onChange={(event) => update({ date_from: event.target.value, page: "1" })} /></Field><Field label="Sampai tanggal"><Input type="date" value={dateTo} onChange={(event) => update({ date_to: event.target.value, page: "1" })} /></Field></div>{rows.length === 0 ? <EmptyState title="Belum ada pelanggaran" description="Catatan disiplin akan muncul setelah dibuat." /> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="py-3 pr-4">Nomor</th><th className="py-3 pr-4">Karyawan</th><th className="py-3 pr-4">Kejadian</th><th className="py-3 pr-4">Jenis / sanksi</th><th className="py-3 pr-4">Status</th><th className="py-3">Tindakan</th></tr></thead><tbody className="divide-y">{rows.map((item) => <tr key={item.id}><td className="py-3 pr-4 font-medium">{item.violation_number ?? "Draft"}</td><td className="py-3 pr-4">{item.employee_name ?? item.employee_id}</td><td className="py-3 pr-4">{formatDate(item.incident_date)}<p className="text-xs text-muted-foreground">{item.description}</p></td><td className="py-3 pr-4">{item.type?.name ?? item.violation_type_id}<p className="text-xs text-muted-foreground">{item.sanction_type}</p></td><td className="py-3 pr-4"><Badge variant={item.status === "issued" || item.status === "acknowledged" ? "secondary" : "outline"}>{statusLabel(item.status)}</Badge></td><td className="py-3"><div className="flex gap-2">{item.status === "draft" && canIssue ? <Button size="sm" disabled={action.isPending} onClick={() => action.mutate({ id: item.id, verb: "issue" })}>Terbitkan</Button> : null}{["issued", "acknowledged", "appealed"].includes(item.status) && canManage ? <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => { if (window.confirm("Cabut surat peringatan ini? Tindakan akan tercatat pada audit.")) action.mutate({ id: item.id, verb: "revoke" }); }}>Cabut</Button> : null}</div></td></tr>)}</tbody></table></div>}{pagination && pagination.last_page > 1 ? <Pager page={page} lastPage={pagination.last_page} onPage={(next) => update({ page: String(next) })} /> : null}</CardContent></Card>{canManage ? <ViolationTypesCard types={types.data?.data ?? []} onSaved={() => void client.invalidateQueries({ queryKey: ["operations", "violation-types"] })} /> : null}</div>;
}

function ViolationForm({ employees, types, canChooseEmployee, pending, onSubmit }: { employees: Employee[]; types: ViolationType[]; canChooseEmployee: boolean; pending: boolean; onSubmit: (payload: StoreViolationRequest) => void }) {
  const [employeeId, setEmployeeId] = useState("");
  const [typeId, setTypeId] = useState("");
  const selectedType = types.find((item) => item.id === typeId);
  return <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const incidentDate = String(form.get("incident_date") ?? ""); const description = String(form.get("description") ?? ""); if (!employeeId || !typeId || !incidentDate || !description.trim()) return; const sanction = String(form.get("sanction_type") ?? ""); const legalBasis = String(form.get("legal_basis") ?? ""); const validFrom = String(form.get("valid_from") ?? ""); const validTo = String(form.get("valid_to") ?? ""); const documentFileId = String(form.get("document_file_id") ?? ""); onSubmit({ employee_id: employeeId, violation_type_id: typeId, incident_date: incidentDate, description, ...(sanction ? { sanction_type: sanction as StoreViolationRequest["sanction_type"] } : {}), legal_basis: legalBasis || null, valid_from: validFrom || null, valid_to: validTo || null, document_file_id: documentFileId || null }); }}><Field label="Karyawan">{canChooseEmployee ? <EmployeeSelect employees={employees} value={employeeId} onChange={setEmployeeId} required /> : <Input aria-label="ID karyawan" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} required placeholder="ULID karyawan" />}</Field><Field label="Jenis pelanggaran"><select aria-label="Jenis pelanggaran" className="h-10 rounded-lg border bg-background px-3 text-sm" value={typeId} onChange={(event) => setTypeId(event.target.value)} required><option value="">Pilih jenis</option>{types.filter((item) => item.is_active).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.category}</option>)}</select></Field><Field label="Tanggal kejadian"><Input type="date" name="incident_date" required /></Field><Field label="Sanksi"><select name="sanction_type" className="h-10 rounded-lg border bg-background px-3 text-sm" defaultValue=""> <option value="">Gunakan sanksi default jenis</option>{["verbal", "sp1", "sp2", "sp3", "termination", "other"].map((item) => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select><span className="text-xs text-muted-foreground">Default jenis: {selectedType?.default_sanction ?? "tidak ditentukan"}</span></Field><Field label="Masa berlaku mulai"><Input type="date" name="valid_from" /></Field><Field label="Masa berlaku sampai"><Input type="date" name="valid_to" /></Field><Field label="Dasar aturan"><Input name="legal_basis" maxLength={5000} placeholder="Opsional" /></Field><Field label="ID dokumen tenant"><Input name="document_file_id" placeholder="ULID file (wajib sesuai jenis sanksi)" /></Field><Field label="Deskripsi kejadian"><textarea name="description" required minLength={3} maxLength={5000} className="min-h-24 rounded-lg border bg-background px-3 py-2 text-sm md:col-span-2" /></Field><div className="md:col-span-2"><Button disabled={pending || !employeeId || !typeId}>{pending ? "Menyimpan…" : "Simpan sebagai draft"}</Button></div></form>;
}

function ViolationTypesCard({ types, onSaved }: { types: ViolationType[]; onSaved: () => void }) {
  const client = useQueryClient();
  const mutation = useMutation({
    mutationFn: (payload: StoreViolationTypeRequest) => apiFetch<ViolationType>("violations/types", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: () => { toast.success("Jenis pelanggaran ditambahkan"); onSaved(); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<unknown>(`violations/types/${id}`, { method: "DELETE" }),
    onSuccess: async () => { toast.success("Jenis pelanggaran dihapus"); await client.invalidateQueries({ queryKey: ["operations", "violation-types"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return <Card><CardHeader><CardTitle>Jenis pelanggaran</CardTitle><CardDescription>Jenis yang sudah dipakai tidak dapat dihapus; API menjaga referensi histori.</CardDescription></CardHeader><CardContent className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,.8fr)]"><form className="grid gap-3 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); mutation.mutate({ code: String(form.get("code")), name: String(form.get("name")), category: String(form.get("category")) as StoreViolationTypeRequest["category"], default_sanction: String(form.get("default_sanction")) as StoreViolationTypeRequest["default_sanction"], validity_months: Number(form.get("validity_months")) }); event.currentTarget.reset(); }}><Field label="Kode"><Input name="code" maxLength={50} required /></Field><Field label="Nama"><Input name="name" maxLength={120} required /></Field><Field label="Kategori"><select name="category" className="h-10 rounded-lg border bg-background px-3 text-sm">{["light", "moderate", "severe"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Sanksi default"><select name="default_sanction" className="h-10 rounded-lg border bg-background px-3 text-sm">{["verbal", "sp1", "sp2", "sp3", "termination", "other"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Masa berlaku (bulan)"><Input name="validity_months" type="number" min="1" max="120" defaultValue="6" required /></Field><div className="flex items-end"><Button disabled={mutation.isPending}>Tambah jenis</Button></div></form><div className="divide-y rounded-lg border">{types.length ? types.map((item) => <div key={item.id} className="flex items-center gap-3 p-3 text-sm"><div className="min-w-0 flex-1"><p className="font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{item.code} · {item.category} · {item.validity_months} bulan</p></div><Badge variant={item.is_active ? "secondary" : "outline"}>{item.is_active ? "Aktif" : "Nonaktif"}</Badge><Button aria-label={`Hapus jenis ${item.name}`} size="sm" variant="ghost" disabled={remove.isPending} onClick={() => { if (window.confirm(`Hapus jenis ${item.name}? Jenis yang telah dipakai akan ditolak API.`)) remove.mutate(item.id); }}>Hapus</Button></div>) : <p className="p-3 text-sm text-muted-foreground">Belum ada jenis pelanggaran.</p>}</div></CardContent></Card>;
}

function AnnouncementsView({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const canManage = hasPermission(permissions, "announcement.manage");
  const [createdId, setCreatedId] = useState("");
  const [createdStatus, setCreatedStatus] = useState<Announcement["status"] | "">("");
  const [selectedReads, setSelectedReads] = useState("");
  const announcements = useQuery({ queryKey: ["operations", "announcements"], queryFn: () => apiFetchEnvelope<Announcement[]>("announcements") });
  const reads = useQuery({ queryKey: ["operations", "announcement-reads", selectedReads], queryFn: () => apiFetchEnvelope<AnnouncementRead[]>(`announcements/${selectedReads}/reads`), enabled: Boolean(selectedReads) && hasPermission(permissions, "announcement.view") });
  const create = useMutation({
    mutationFn: (payload: StoreAnnouncementRequest) => apiFetch<Announcement>("announcements", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async (announcement) => { setCreatedId(announcement.id); setCreatedStatus(announcement.status); toast.success("Draft pengumuman dibuat. Terbitkan saat siap."); await client.invalidateQueries({ queryKey: ["operations", "announcements"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const publish = useMutation({
    mutationFn: (id: string) => apiFetch<Announcement>(`announcements/${id}/publish`, { method: "POST" }),
    onSuccess: async (announcement) => { setCreatedStatus(announcement.status); setCreatedId(announcement.status === "scheduled" ? announcement.id : ""); toast.success(announcement.status === "scheduled" ? "Pengumuman dijadwalkan" : "Pengumuman diterbitkan"); await client.invalidateQueries({ queryKey: ["operations", "announcements"] }); if (announcement.status === "published") await announcements.refetch(); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const archive = useMutation({
    mutationFn: (id: string) => apiFetch<Announcement>(`announcements/${id}/archive`, { method: "POST" }),
    onSuccess: async () => { toast.success("Pengumuman diarsipkan"); await client.invalidateQueries({ queryKey: ["operations", "announcements"] }); await announcements.refetch(); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  if (announcements.isLoading) return <LoadingState label="Memuat pengumuman" />;
  if (announcements.isError) return <ErrorState message={getErrorMessage(announcements.error)} retry={() => void announcements.refetch()} />;
  const rows = announcements.data?.data ?? [];
  return <div className="flex flex-col gap-4">{canManage ? <Card><CardHeader><CardTitle>Buat pengumuman</CardTitle><CardDescription>Pengumuman disimpan sebagai draft terlebih dahulu; pilih target dengan cermat sebelum diterbitkan.</CardDescription></CardHeader><CardContent><AnnouncementForm pending={create.isPending} onSubmit={(payload) => create.mutate(payload)} /></CardContent></Card> : null}{createdId ? <Card className="border-blue-200 bg-blue-50/60"><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5"><p className="text-sm">{createdStatus === "scheduled" ? "Pengumuman terjadwal. Daftar pengelolaan draft belum tersedia pada API." : "Draft baru siap. Terbitkan agar tampil ke target yang dipilih."}</p>{createdStatus !== "scheduled" ? <Button disabled={publish.isPending} onClick={() => publish.mutate(createdId)}>{publish.isPending ? "Menerbitkan…" : "Terbitkan sekarang"}</Button> : null}</CardContent></Card> : null}<Card><CardHeader><CardTitle>Pengumuman terbit</CardTitle><CardDescription>Daftar mengikuti visibilitas target akun login dari API.</CardDescription></CardHeader><CardContent>{rows.length ? <div className="divide-y">{rows.map((item) => <div key={item.id} className="flex flex-wrap items-start gap-3 py-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{item.title}</h3><Badge variant={item.priority === "urgent" ? "destructive" : item.priority === "important" ? "secondary" : "outline"}>{statusLabel(item.priority)}</Badge></div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">Target {statusLabel(item.target_type)} · terbit {item.publish_at ? formatDateTime(item.publish_at) : "sekarang"}{item.expires_at ? ` · berakhir ${formatDateTime(item.expires_at)}` : ""}</p></div>{hasPermission(permissions, "announcement.view") ? <Button size="sm" variant="outline" onClick={() => setSelectedReads((current) => current === item.id ? "" : item.id)}>Pembaca</Button> : null}{canManage && item.status === "published" ? <Button size="sm" variant="outline" disabled={archive.isPending} onClick={() => { if (window.confirm(`Arsipkan pengumuman “${item.title}”?`)) archive.mutate(item.id); }}>Arsipkan</Button> : null}{selectedReads === item.id && reads.data?.data ? <ReadsList rows={reads.data.data} kind="announcement" /> : null}</div>)}</div> : <EmptyState title="Belum ada pengumuman yang terlihat" description="Pengumuman terbit akan muncul sesuai target dan rentang waktunya." />}</CardContent></Card></div>;
}

function AnnouncementForm({ pending, onSubmit }: { pending: boolean; onSubmit: (payload: StoreAnnouncementRequest) => void }) {
  return <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const targetType = String(form.get("target_type")) as StoreAnnouncementRequest["target_type"]; const targetIds = String(form.get("target_ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean); const publishAt = String(form.get("publish_at") ?? ""); const expiresAt = String(form.get("expires_at") ?? ""); onSubmit({ title: String(form.get("title")), body: String(form.get("body")), target_type: targetType, target_ids: targetType === "all" ? null : targetIds, priority: String(form.get("priority")) as StoreAnnouncementRequest["priority"], publish_at: publishAt ? new Date(publishAt).toISOString() : null, expires_at: expiresAt ? new Date(expiresAt).toISOString() : null }); event.currentTarget.reset(); }}><Field label="Judul"><Input name="title" maxLength={180} required /></Field><Field label="Prioritas"><select name="priority" className="h-10 rounded-lg border bg-background px-3 text-sm">{["normal", "important", "urgent"].map((item) => <option key={item}>{item}</option>)}</select></Field><Field label="Target"><select name="target_type" className="h-10 rounded-lg border bg-background px-3 text-sm">{["all", "branch", "department", "group", "employee", "role"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></Field><Field label="Target ID (pisahkan dengan koma)"><Input name="target_ids" placeholder="Wajib selain target semua" /></Field><Field label="Jadwalkan terbit"><Input type="datetime-local" name="publish_at" /></Field><Field label="Kedaluwarsa"><Input type="datetime-local" name="expires_at" /></Field><Field label="Isi pengumuman"><textarea name="body" required minLength={3} maxLength={20000} className="min-h-28 rounded-lg border bg-background px-3 py-2 text-sm md:col-span-2" /></Field><div className="md:col-span-2"><Button disabled={pending}>{pending ? "Menyimpan…" : "Simpan draft"}</Button></div></form>;
}

function LmsView({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const canManage = hasPermission(permissions, "lms.manage");
  const [createdId, setCreatedId] = useState("");
  const [selectedReads, setSelectedReads] = useState("");
  const canViewSummary = hasPermission(permissions, "lms.view");
  const materials = useQuery({ queryKey: ["operations", "lms-materials"], queryFn: () => apiFetchEnvelope<LmsMaterial[]>("lms/materials") });
  const summary = useQuery({ queryKey: ["operations", "lms-summary"], queryFn: () => apiFetchEnvelope<{ material_count: number; mandatory_count: number; total_reads: number; reader_count: number; mandatory_completion_rate: number }>("lms/summary"), enabled: canViewSummary });
  const reads = useQuery({ queryKey: ["operations", "lms-reads", selectedReads], queryFn: () => apiFetchEnvelope<LmsRead[]>(`lms/materials/${selectedReads}/reads`), enabled: Boolean(selectedReads) && hasPermission(permissions, "lms.view") });
  const create = useMutation({
    mutationFn: (payload: StoreLmsMaterialRequest) => apiFetch<LmsMaterial>("lms/materials", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async (material) => { setCreatedId(material.id); toast.success("Materi disimpan sebagai draft"); await client.invalidateQueries({ queryKey: ["operations", "lms-materials"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const publish = useMutation({
    mutationFn: (id: string) => apiFetch<LmsMaterial>(`lms/materials/${id}/publish`, { method: "POST" }),
    onSuccess: async () => { setCreatedId(""); toast.success("Materi diterbitkan"); await client.invalidateQueries({ queryKey: ["operations", "lms-materials"] }); await client.invalidateQueries({ queryKey: ["operations", "lms-summary"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const archive = useMutation({
    mutationFn: (id: string) => apiFetch<LmsMaterial>(`lms/materials/${id}/archive`, { method: "POST" }),
    onSuccess: async () => { toast.success("Materi diarsipkan"); await client.invalidateQueries({ queryKey: ["operations", "lms-materials"] }); await client.invalidateQueries({ queryKey: ["operations", "lms-summary"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  if (materials.isLoading || (canViewSummary && summary.isLoading)) return <LoadingState label="Memuat materi pembelajaran" />;
  if (materials.isError) return <ErrorState message={getErrorMessage(materials.error)} retry={() => void materials.refetch()} />;
  if (canViewSummary && summary.isError) return <ErrorState message={getErrorMessage(summary.error)} retry={() => void summary.refetch()} />;
  const totals = summary.data?.data;
  const rows = materials.data?.data ?? [];
  return <div className="flex flex-col gap-4">{canViewSummary ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Materi terbit", totals?.material_count], ["Wajib", totals?.mandatory_count], ["Pembacaan", totals?.total_reads], ["Completion", `${totals?.mandatory_completion_rate ?? 0}%`]].map(([label, value]) => <Card key={String(label)}><CardContent className="pt-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold">{value ?? 0}</p></CardContent></Card>)}</div> : null}{canManage ? <Card><CardHeader><CardTitle>Terbitkan materi</CardTitle><CardDescription>Masukkan ID file yang sudah tersimpan di storage privat tenant. Upload materi belum tersedia pada kontrak API.</CardDescription></CardHeader><CardContent><LmsForm pending={create.isPending} onSubmit={(payload) => create.mutate(payload)} /></CardContent></Card> : null}{createdId ? <Card className="border-blue-200 bg-blue-50/60"><CardContent className="flex flex-wrap items-center justify-between gap-3 pt-5"><p className="text-sm">Draft materi siap diterbitkan.</p><Button disabled={publish.isPending} onClick={() => publish.mutate(createdId)}>{publish.isPending ? "Menerbitkan…" : "Terbitkan materi"}</Button></CardContent></Card> : null}<Card><CardHeader><CardTitle>Materi yang dapat diakses</CardTitle><CardDescription>Materi tampil sesuai target akun login. Angka penyelesaian berasal dari API.</CardDescription></CardHeader><CardContent>{rows.length ? <div className="divide-y">{rows.map((item) => <div key={item.id} className="flex flex-wrap items-start gap-3 py-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{item.title}</h3>{item.is_mandatory ? <Badge variant="secondary">Wajib</Badge> : null}<Badge variant="outline">{statusLabel(item.status)}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.category} · {item.code}</p>{item.description ? <p className="mt-2 whitespace-pre-wrap text-sm">{item.description}</p> : null}<p className="mt-2 text-xs text-muted-foreground">Diterbitkan {item.published_at ? formatDateTime(item.published_at) : "—"}{item.file_size ? ` · ${formatBytes(item.file_size)}` : ""}</p></div>{hasPermission(permissions, "lms.view") ? <Button size="sm" variant="outline" onClick={() => setSelectedReads((current) => current === item.id ? "" : item.id)}>Pembaca</Button> : null}{canManage && item.status === "published" ? <Button size="sm" variant="outline" disabled={archive.isPending} onClick={() => { if (window.confirm(`Arsipkan materi “${item.title}”?`)) archive.mutate(item.id); }}>Arsipkan</Button> : null}{selectedReads === item.id && reads.data?.data ? <ReadsList rows={reads.data.data} kind="lms" /> : null}</div>)}</div> : <EmptyState title="Belum ada materi yang terlihat" description="Materi yang diterbitkan tampil sesuai target karyawan." />}</CardContent></Card></div>;
}

function LmsForm({ pending, onSubmit }: { pending: boolean; onSubmit: (payload: StoreLmsMaterialRequest) => void }) {
  return <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const targetType = String(form.get("target_type")) as StoreLmsMaterialRequest["target_type"]; const targetIds = String(form.get("target_ids") ?? "").split(",").map((id) => id.trim()).filter(Boolean); onSubmit({ code: String(form.get("code")), title: String(form.get("title")), category: String(form.get("category")), description: String(form.get("description") ?? "") || null, file_id: String(form.get("file_id")), target_type: targetType, target_ids: targetType === "all" ? null : targetIds, is_mandatory: form.get("is_mandatory") === "on" }); event.currentTarget.reset(); }}><Field label="Kode materi"><Input name="code" maxLength={50} required /></Field><Field label="Judul"><Input name="title" maxLength={180} required /></Field><Field label="Kategori"><Input name="category" maxLength={100} required placeholder="SOP & Kebijakan" /></Field><Field label="ID file"><Input name="file_id" required placeholder="ULID file privat tenant" /></Field><Field label="Target"><select name="target_type" className="h-10 rounded-lg border bg-background px-3 text-sm">{["all", "branch", "department", "group", "employee"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select></Field><Field label="ID target (pisahkan dengan koma)"><Input name="target_ids" placeholder="Wajib selain target semua" /></Field><Field label="Deskripsi"><textarea name="description" maxLength={10000} className="min-h-24 rounded-lg border bg-background px-3 py-2 text-sm md:col-span-2" /></Field><label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" name="is_mandatory" className="size-4 rounded border" />Materi wajib dibaca</label><div className="md:col-span-2"><Button disabled={pending}>{pending ? "Menyimpan…" : "Simpan draft materi"}</Button></div></form>;
}

function ReadsList({ rows, kind }: { rows: AnnouncementRead[] | LmsRead[]; kind: "announcement" | "lms" }) {
  return <div className="basis-full rounded-lg bg-muted/50 p-3 text-sm"><h4 className="font-medium">{kind === "lms" ? "Riwayat pembacaan" : "Pembaca pengumuman"} · {rows.length}</h4>{rows.length ? <ul className="mt-2 divide-y">{rows.map((row, index) => <li key={`${row.employee_id}-${index}`} className="flex justify-between gap-3 py-2"><span>{row.employee_name ?? row.employee_id}</span><span className="text-xs text-muted-foreground">{kind === "lms" ? `${(row as LmsRead).read_count}× · ${formatDateTime((row as LmsRead).last_read_at)}` : formatDateTime((row as AnnouncementRead).read_at)}</span></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">Belum ada data pembacaan.</p>}</div>;
}

function Pager({ page, lastPage, onPage }: { page: number; lastPage: number; onPage: (page: number) => void }) {
  return <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4 text-sm"><span>Halaman {page} dari {lastPage}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Sebelumnya</Button><Button size="sm" variant="outline" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>Berikutnya</Button></div></div>;
}

function statusLabel(value: string): string {
  const labels: Record<string, string> = { planned: "Direncanakan", in_progress: "Berlangsung", completed: "Selesai", cancelled: "Dibatalkan", submitted: "Menunggu verifikasi", verified: "Terverifikasi", rejected: "Ditolak", draft: "Draft", issued: "Diterbitkan", acknowledged: "Diakui", appealed: "Banding", revoked: "Dicabut", expired: "Kedaluwarsa", normal: "Normal", important: "Penting", urgent: "Mendesak", all: "Semua karyawan", branch: "Cabang", department: "Departemen", group: "Grup", employee: "Karyawan", role: "Role" };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
