"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Download, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Phase2Navigation } from "@/components/phase2-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { ApiError, apiFetch, apiFetchEnvelope } from "@/lib/api/client";
import type { Branch, Employee, MinPersonnelRule, OrganizationUnit, RosterMatrix, ScheduleAssignment, SchedulePeriod, ShiftPattern, ShiftSwap, WorkSchedule } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";

export type SchedulingView = "master" | "assignments" | "patterns" | "periods" | "matrix" | "minimum" | "swaps";

export function AdminSchedulingView({ view, permissions, periodId }: { view: SchedulingView; permissions: string[]; periodId?: string }) {
  if (view === "master" && !hasPermission(permissions, "schedule.view")) return <UnauthorizedState />;
  if (view === "assignments" && !hasPermission(permissions, "schedule.view")) return <UnauthorizedState />;
  if (view === "patterns" && !hasPermission(permissions, "shift_pattern.view")) return <UnauthorizedState />;
  if ((view === "periods" || view === "matrix" || view === "minimum") && !hasPermission(permissions, "roster.view")) return <UnauthorizedState />;
  if (view === "swaps" && !hasPermission(permissions, "shift_swap.view")) return <UnauthorizedState />;

  if (view === "master") return <WorkSchedulesView permissions={permissions} />;
  if (view === "assignments") return <AssignmentsView permissions={permissions} />;
  if (view === "patterns") return <ShiftPatternsView permissions={permissions} />;
  if (view === "periods") return <RosterPeriodsView permissions={permissions} />;
  if (view === "matrix") return <RosterMatrixView periodId={periodId ?? ""} permissions={permissions} />;
  if (view === "minimum") return <MinimumPersonnelView permissions={permissions} />;
  return <ShiftSwapsView permissions={permissions} />;
}

function WorkSchedulesView({ permissions }: { permissions: string[] }) {
  const canManage = hasPermission(permissions, "schedule.manage");
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<WorkSchedule | null>(null);
  const schedules = useQuery({ queryKey: ["work-schedules"], queryFn: () => apiFetchEnvelope<WorkSchedule[]>("schedules") });
  const [form, setForm] = useState({ code: "", name: "", start_time: "08:00", end_time: "17:00", break_enabled: true, break_start: "12:00", break_end: "13:00", is_default: false, is_active: true, notes: "" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const calculation = calculateSchedule(form);
  function updateForm(patch: Partial<typeof form>) {
    setForm((current) => ({ ...current, ...patch }));
    setFormErrors({});
  }
  const save = useMutation({
    mutationFn: () => apiFetch<WorkSchedule>(editing ? `schedules/${editing.id}` : "schedules", { method: editing ? "PATCH" : "POST", body: JSON.stringify({ ...form, break_start: form.break_enabled ? form.break_start || null : null, break_end: form.break_enabled ? form.break_end || null : null }) }),
    onSuccess: async () => { toast.success(editing ? "Jadwal diperbarui" : "Jadwal dibuat"); reset(); await queryClient.invalidateQueries({ queryKey: ["work-schedules"] }); },
    onError: (error) => {
      const errors = error instanceof ApiError ? Object.fromEntries(Object.entries(error.fieldErrors ?? {}).map(([field, messages]) => [field, messages[0] ?? "Nilai tidak valid."])) : {};
      setFormErrors(errors);
      toast.error(Object.values(errors).length ? Object.values(errors).join(" ") : getErrorMessage(error));
    },
  });
  const remove = useMutation({ mutationFn: (id: string) => apiFetch<null>(`schedules/${id}`, { method: "DELETE" }), onSuccess: async () => { toast.success("Jadwal dihapus"); await queryClient.invalidateQueries({ queryKey: ["work-schedules"] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  function reset() { setEditing(null); setFormErrors({}); setForm({ code: "", name: "", start_time: "08:00", end_time: "17:00", break_enabled: true, break_start: "12:00", break_end: "13:00", is_default: false, is_active: true, notes: "" }); }
  function beginEdit(schedule: WorkSchedule) { setEditing(schedule); setFormErrors({}); setForm({ code: schedule.code, name: schedule.name, start_time: schedule.start_time.slice(0, 5), end_time: schedule.end_time.slice(0, 5), break_enabled: schedule.break_enabled, break_start: schedule.break_start?.slice(0, 5) ?? "", break_end: schedule.break_end?.slice(0, 5) ?? "", is_default: schedule.is_default, is_active: schedule.is_active, notes: schedule.notes ?? "" }); }
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validateSchedule(form);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error(Object.values(errors)[0]);
      return;
    }
    save.mutate();
  }
  if (schedules.isLoading) return <LoadingState label="Memuat jadwal kerja" />;
  if (schedules.isError) return <ErrorState message={getErrorMessage(schedules.error)} retry={() => void schedules.refetch()} />;
  const rows = schedules.data?.data ?? [];
  const activeCount = rows.filter((schedule) => schedule.is_active).length;
  const defaultCount = rows.filter((schedule) => schedule.is_default).length;
  const crossDayCount = rows.filter((schedule) => schedule.is_cross_day).length;
  return <Phase2Frame permissions={permissions} title="Master Jadwal Kerja" description="Kelola definisi jam kerja dan waktu istirahat tenant.">
    <div className="grid gap-3 sm:grid-cols-3"><Stat label="Jadwal aktif" value={activeCount} /><Stat label="Jadwal default" value={defaultCount} tone="emerald" /><Stat label="Cross-day" value={crossDayCount} tone="amber" /></div>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.1fr)]">
      <Card><CardHeader><CardTitle>{editing ? "Ubah Jadwal Kerja" : "Form Jadwal Kerja"}</CardTitle><p className="text-xs text-muted-foreground">POST/PATCH /schedules · schedule.manage</p></CardHeader><CardContent>
        {canManage ? <form className="space-y-4" noValidate onSubmit={submit}>
          <div className="grid gap-3 sm:grid-cols-2"><Field label="Kode *" error={formErrors.code}><Input aria-invalid={Boolean(formErrors.code)} required maxLength={20} value={form.code} onChange={(event) => updateForm({ code: event.target.value })} /></Field><Field label="Nama *" error={formErrors.name}><Input aria-invalid={Boolean(formErrors.name)} required maxLength={100} value={form.name} onChange={(event) => updateForm({ name: event.target.value })} /></Field>
            <Field label="Mulai *" error={formErrors.start_time}><Input aria-invalid={Boolean(formErrors.start_time)} required type="time" value={form.start_time} onChange={(event) => updateForm({ start_time: event.target.value })} /></Field><Field label="Selesai *" error={formErrors.end_time}><Input aria-invalid={Boolean(formErrors.end_time)} required type="time" value={form.end_time} onChange={(event) => updateForm({ end_time: event.target.value })} /></Field></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.break_enabled} onChange={(event) => updateForm({ break_enabled: event.target.checked })} />Istirahat aktif</label>
          {form.break_enabled ? <div className="grid gap-3 sm:grid-cols-2"><Field label="Mulai istirahat" error={formErrors.break_start}><Input aria-invalid={Boolean(formErrors.break_start)} type="time" value={form.break_start} onChange={(event) => updateForm({ break_start: event.target.value })} /></Field><Field label="Selesai istirahat" error={formErrors.break_end}><Input aria-invalid={Boolean(formErrors.break_end)} type="time" value={form.break_end} onChange={(event) => updateForm({ break_end: event.target.value })} /></Field></div> : null}
          {calculation.error ? <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{calculation.error}</div> : null}
          {calculation.valid ? <div className="rounded-lg border border-blue-200 bg-blue-50/70 px-3 py-2 text-xs text-blue-900"><strong>Hasil perhitungan:</strong> {calculation.crossDay ? "Shift melewati tengah malam" : "Shift dalam hari yang sama"} · durasi kotor {formatHours(calculation.grossMinutes)}{form.break_enabled && calculation.breakMinutes > 0 ? ` · istirahat ${formatHours(calculation.breakMinutes)}` : ""} · durasi bersih <strong>{formatHours(calculation.netMinutes)}</strong></div> : null}
          <Field label="Catatan" error={formErrors.notes}><textarea aria-invalid={Boolean(formErrors.notes)} className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm" value={form.notes} onChange={(event) => updateForm({ notes: event.target.value })} /></Field>
          <div className="flex flex-wrap gap-4 text-sm"><label className="flex items-center gap-2"><input type="checkbox" checked={form.is_default} onChange={(event) => updateForm({ is_default: event.target.checked })} />Jadikan jadwal default</label><label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={(event) => updateForm({ is_active: event.target.checked })} />Aktif</label></div>
          <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">Jam selesai ≤ jam mulai otomatis menandai cross-day. Jam istirahat harus berada sepenuhnya di dalam jam kerja.</p>
          <div className="flex gap-2">{editing ? <Button type="button" variant="outline" onClick={reset}>Batal</Button> : null}<Button disabled={save.isPending}>{save.isPending ? "Menyimpan…" : editing ? "Simpan perubahan" : "Tambah jadwal"}</Button></div>
        </form> : <p className="text-sm text-muted-foreground">Anda hanya memiliki akses lihat.</p>}
      </CardContent></Card>
      <Card><CardHeader><CardTitle>Daftar Jadwal Kerja</CardTitle><p className="text-xs text-muted-foreground">GET /schedules · schedule.view</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead><tr className="bg-muted/50 text-left text-xs text-muted-foreground"><th className="px-4 py-3">Kode</th><th className="px-4 py-3">Nama</th><th className="px-4 py-3">Jam</th><th className="px-4 py-3">Netto</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aksi</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-4 text-xs">{row.code}</td><td className="px-4 py-4 font-medium">{row.name}</td><td className="px-4 py-4 text-xs">{row.start_time.slice(0, 5)}–{row.end_time.slice(0, 5)}{row.is_cross_day ? " +1" : ""}</td><td className="px-4 py-4">{row.total_hours.toFixed(2)} jam</td><td className="px-4 py-4"><Badge className={row.is_default ? "bg-blue-50 text-blue-700" : row.is_active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}>{row.is_default ? "Default" : row.is_active ? "Aktif" : "Nonaktif"}</Badge></td><td className="px-4 py-4"><div className="flex gap-1"><Button size="sm" variant="outline" disabled={!canManage} onClick={() => beginEdit(row)}>Ubah</Button><Button size="icon-sm" variant="ghost" aria-label={`Hapus ${row.name}`} disabled={!canManage || remove.isPending} onClick={() => { if (window.confirm(`Hapus jadwal ${row.name}?`)) remove.mutate(row.id); }}><Trash2 className="size-4" /></Button></div></td></tr>)}</tbody></table></div>{rows.length === 0 ? <div className="p-5"><EmptyState title="Belum ada jadwal kerja" description="Tambahkan jadwal kerja pertama untuk mulai menyusun shift." /></div> : <p className="border-t px-4 py-3 text-xs text-muted-foreground">Default hanya boleh satu per tenant · break harus berpasangan.</p>}</CardContent></Card>
    </div>
  </Phase2Frame>;
}

function AssignmentsView({ permissions }: { permissions: string[] }) {
  const canManage = hasPermission(permissions, "schedule.manage");
  const client = useQueryClient();
  const [scopeType, setScopeType] = useState<ScheduleAssignment["scope_type"]>("employee");
  const [scopeId, setScopeId] = useState("");
  const [day, setDay] = useState("1");
  const [dateSpecific, setDateSpecific] = useState("");
  const [scheduleId, setScheduleId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [effectiveTo, setEffectiveTo] = useState("");
  const [priority, setPriority] = useState("10");
  const [employeeForEffective, setEmployeeForEffective] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(today());
  const schedules = useQuery({ queryKey: ["work-schedules"], queryFn: () => apiFetchEnvelope<WorkSchedule[]>("schedules") });
  const assignments = useQuery({ queryKey: ["schedule-assignments"], queryFn: () => apiFetchEnvelope<ScheduleAssignment[]>("schedules/assignments?per_page=100&page=1") });
  const employees = useQuery({ queryKey: ["employees", "schedule-assignment"], queryFn: () => apiFetchEnvelope<Employee[]>("employees?per_page=100&is_active=true") });
  const branches = useQuery({ queryKey: ["organization", "branches"], queryFn: () => apiFetchEnvelope<Branch[]>("organization/branches?per_page=100") });
  const departments = useQuery({ queryKey: ["organization", "departments"], queryFn: () => apiFetchEnvelope<OrganizationUnit[]>("organization/departments?per_page=100") });
  const groups = useQuery({ queryKey: ["organization", "groups"], queryFn: () => apiFetchEnvelope<OrganizationUnit[]>("organization/groups?per_page=100") });
  const effectiveParams = new URLSearchParams({ date: effectiveDate });
  if (employeeForEffective) effectiveParams.set("employee_id", employeeForEffective);
  const effective = useQuery({ queryKey: ["effective-schedule", employeeForEffective, effectiveDate], queryFn: () => apiFetchEnvelope<unknown>(`schedules/effective?${effectiveParams}`), enabled: Boolean(employeeForEffective) });
  const create = useMutation({ mutationFn: () => apiFetch<ScheduleAssignment>("schedules/assignments", { method: "POST", body: JSON.stringify({ scope_type: scopeType, scope_id: scopeType === "tenant" ? null : scopeId, day_of_week: dateSpecific ? null : Number(day), specific_date: dateSpecific || null, work_schedule_id: scheduleId || null, effective_from: effectiveFrom, effective_to: effectiveTo || null, priority: Number(priority) }) }), onSuccess: async () => { toast.success("Assignment jadwal dibuat"); await client.invalidateQueries({ queryKey: ["schedule-assignments"] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  const remove = useMutation({ mutationFn: (id: string) => apiFetch<null>(`schedules/assignments/${id}`, { method: "DELETE" }), onSuccess: async () => { toast.success("Assignment dihapus"); await client.invalidateQueries({ queryKey: ["schedule-assignments"] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  const rows = assignments.data?.data ?? [];
  const selectedEmployee = employees.data?.data?.find((employee) => employee.id === employeeForEffective);
  const scopeOptions = scopeType === "employee"
    ? (employees.data?.data ?? []).map((employee) => ({ id: employee.id, label: `${employee.full_name} · ${employee.employee_number}` }))
    : scopeType === "branch"
      ? (branches.data?.data ?? []).map((branch) => ({ id: branch.id, label: `${branch.name} · ${branch.code}` }))
      : scopeType === "department"
        ? (departments.data?.data ?? []).map((unit) => ({ id: unit.id, label: `${unit.name} · ${unit.code}` }))
        : scopeType === "group"
          ? (groups.data?.data ?? []).map((unit) => ({ id: unit.id, label: `${unit.name} · ${unit.code}` }))
          : [];
  return <Phase2Frame permissions={permissions} title="Assignment Jadwal & Efektif" description="Atur jadwal per karyawan, grup, departemen, cabang, atau tenant; cek hasil resolusi efektif.">
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(320px,0.85fr)_minmax(0,1.15fr)]">
      <Card><CardHeader><CardTitle>Assignment Jadwal</CardTitle><p className="text-xs text-muted-foreground">POST/PATCH /schedules/assignments · schedule.manage</p></CardHeader><CardContent>{canManage ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <Field label="Jenis scope"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={scopeType} onChange={(event) => setScopeType(event.target.value as ScheduleAssignment["scope_type"])}>{["employee", "group", "department", "branch", "tenant"].map((type) => <option key={type} value={type}>{type}</option>)}</select></Field>
        {scopeType !== "tenant" ? <Field label={`${scopeType} *`}>
          {scopeType === "employee" || scopeType === "branch" || scopeType === "department" || scopeType === "group" ? <select required className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={scopeId} onChange={(event) => setScopeId(event.target.value)}><option value="">Pilih {scopeType}</option>{scopeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select> : <Input required value={scopeId} onChange={(event) => setScopeId(event.target.value)} placeholder="ULID scope" />}
        </Field> : null}
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Hari dalam minggu"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" disabled={Boolean(dateSpecific)} value={day} onChange={(event) => setDay(event.target.value)}>{["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map((label, index) => <option key={label} value={index + 1}>{label} ({index + 1})</option>)}</select></Field><Field label="Tanggal spesifik"><Input type="date" value={dateSpecific} onChange={(event) => setDateSpecific(event.target.value)} /></Field></div>
        <Field label="Jadwal kerja"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={scheduleId} onChange={(event) => setScheduleId(event.target.value)}><option value="">OFF / tidak dijadwalkan</option>{(schedules.data?.data ?? []).map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.code} · {schedule.start_time.slice(0, 5)}–{schedule.end_time.slice(0, 5)}</option>)}</select></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Berlaku mulai *"><Input required type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /></Field><Field label="Berlaku sampai"><Input type="date" value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} /></Field><Field label="Prioritas (0–1000)"><Input type="number" min="0" max="1000" value={priority} onChange={(event) => setPriority(event.target.value)} /></Field></div>
        <p className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">Pilih salah satu: hari mingguan atau tanggal spesifik. Resolusi mengikuti prioritas dan tanggal berlaku.</p><Button disabled={create.isPending}>{create.isPending ? "Menyimpan…" : "Buat Assignment"}</Button>
      </form> : <p className="text-sm text-muted-foreground">Anda hanya memiliki akses lihat.</p>}</CardContent></Card>
      <div className="space-y-4"><Card><CardHeader><CardTitle>Assignment Aktif</CardTitle><p className="text-xs text-muted-foreground">Hierarki ditentukan backend berdasarkan scope, prioritas, dan rentang berlaku.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead><tr className="bg-muted/50 text-left text-xs text-muted-foreground"><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Hari/Tanggal</th><th className="px-4 py-3">Jadwal</th><th className="px-4 py-3">Prioritas</th><th className="px-4 py-3">Aksi</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id} className="border-t"><td className="px-4 py-3">{row.scope_type} · {row.scope_id ?? "tenant"}</td><td className="px-4 py-3">{row.specific_date ?? weekday(row.day_of_week)}</td><td className="px-4 py-3">{row.work_schedule?.code ?? "OFF"}</td><td className="px-4 py-3">{row.priority}</td><td className="px-4 py-3"><Button size="icon-sm" variant="ghost" aria-label="Hapus assignment" disabled={!canManage || remove.isPending} onClick={() => { if (window.confirm("Hapus assignment ini?")) remove.mutate(row.id); }}><Trash2 className="size-4" /></Button></td></tr>)}</tbody></table></div>{rows.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Belum ada assignment.</p> : null}</CardContent></Card>
        <Card><CardHeader><CardTitle>Jadwal Efektif</CardTitle><p className="text-xs text-muted-foreground">GET /schedules/effective</p></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 sm:grid-cols-[1fr_180px]"><select aria-label="Karyawan untuk cek jadwal" className="h-10 rounded-lg border bg-background px-3 text-sm" value={employeeForEffective} onChange={(event) => setEmployeeForEffective(event.target.value)}><option value="">Pilih karyawan</option>{(employees.data?.data ?? []).map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name}</option>)}</select><Input aria-label="Tanggal jadwal efektif" type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} /></div>
          {effective.isFetching ? <p className="text-sm text-muted-foreground">Menghitung jadwal…</p> : effective.isError ? <p className="text-sm text-destructive">{getErrorMessage(effective.error)}</p> : effective.data?.data ? <EffectiveDetails data={effective.data.data} employee={selectedEmployee} /> : <p className="text-sm text-muted-foreground">Pilih karyawan dan tanggal untuk melihat shift efektif.</p>}
        </CardContent></Card></div>
    </div>
  </Phase2Frame>;
}

function ShiftPatternsView({ permissions }: { permissions: string[] }) {
  const canManage = hasPermission(permissions, "shift_pattern.manage");
  const client = useQueryClient();
  const schedules = useQuery({ queryKey: ["work-schedules"], queryFn: () => apiFetchEnvelope<WorkSchedule[]>("schedules") });
  const patterns = useQuery({ queryKey: ["shift-patterns"], queryFn: () => apiFetchEnvelope<ShiftPattern[]>("shift-patterns") });
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [cycle, setCycle] = useState("3"); const [description, setDescription] = useState(""); const [daySchedules, setDaySchedules] = useState<string[]>(["", "", ""]);
  const cycleLength = Math.max(1, Math.min(31, Number(cycle) || 1));
  const save = useMutation({ mutationFn: () => { const cycleDays = Number(cycle); return apiFetch<ShiftPattern>("shift-patterns", { method: "POST", body: JSON.stringify({ code, name, cycle_days: cycleDays, description: description || null, days: Array.from({ length: cycleDays }, (_, index) => ({ day_number: index + 1, work_schedule_id: daySchedules[index] || null, label: daySchedules[index] ? (schedules.data?.data ?? []).find((schedule) => schedule.id === daySchedules[index])?.code ?? `Hari ${index + 1}` : "OFF" })) }) }); }, onSuccess: async () => { toast.success("Pola shift dibuat"); setCode(""); setName(""); setDaySchedules(["", "", ""]); await client.invalidateQueries({ queryKey: ["shift-patterns"] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  const remove = useMutation({ mutationFn: (id: string) => apiFetch<null>(`shift-patterns/${id}`, { method: "DELETE" }), onSuccess: async () => { toast.success("Pola shift dihapus"); await client.invalidateQueries({ queryKey: ["shift-patterns"] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  if (patterns.isLoading) return <LoadingState label="Memuat pola shift" />;
  if (patterns.isError) return <ErrorState message={getErrorMessage(patterns.error)} retry={() => void patterns.refetch()} />;
  return <Phase2Frame permissions={permissions} title="Pola Shift" description="Susun pola siklus kerja berulang dan tandai hari OFF.">
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
      <Card><CardHeader><CardTitle>Form Pola Shift</CardTitle><p className="text-xs text-muted-foreground">POST /shift-patterns · shift_pattern.manage</p></CardHeader><CardContent>{canManage ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Kode *"><Input required maxLength={20} value={code} onChange={(event) => setCode(event.target.value)} /></Field><Field label="Nama *"><Input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} /></Field></div>
        <Field label="Panjang siklus (hari)"><Input required type="number" min="1" max="31" value={cycle} onChange={(event) => { setCycle(event.target.value); setDaySchedules((current) => current.slice(0, Math.max(1, Math.min(31, Number(event.target.value) || 1)))); }} /></Field>
        <div className="space-y-2"><p className="text-sm font-medium">Jadwal per hari siklus</p>{Array.from({ length: cycleLength }, (_, index) => <div key={index} className="grid grid-cols-[72px_1fr] items-center gap-3"><span className="text-xs text-muted-foreground">Hari {index + 1}</span><select aria-label={`Jadwal hari ke-${index + 1}`} className="h-9 rounded-lg border bg-background px-3 text-sm" value={daySchedules[index] ?? ""} onChange={(event) => setDaySchedules((current) => { const next = [...current]; next[index] = event.target.value; return next; })}><option value="">OFF</option>{(schedules.data?.data ?? []).map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.code} · {schedule.name}</option>)}</select></div>)}</div>
        <Field label="Deskripsi"><textarea className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
        <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">Siklus 1–31 hari. Hari tanpa jadwal akan disimpan sebagai OFF.</p><Button disabled={save.isPending}>{save.isPending ? "Menyimpan…" : "Buat Pola Shift"}</Button>
      </form> : <p className="text-sm text-muted-foreground">Anda hanya memiliki akses lihat.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Daftar Pola</CardTitle></CardHeader><CardContent className="space-y-3">{(patterns.data?.data ?? []).length === 0 ? <EmptyState title="Belum ada pola shift" description="Tambahkan pola rotasi kerja untuk membuat roster secara otomatis." /> : (patterns.data?.data ?? []).map((pattern) => <div key={pattern.id} className="rounded-xl border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold">{pattern.name}</p><p className="mt-1 text-xs text-muted-foreground">{pattern.code} · siklus {pattern.cycle_days} hari</p></div><div className="flex items-center gap-2"><Badge variant={pattern.is_active ? "secondary" : "outline"}>{pattern.is_active ? "Aktif" : "Nonaktif"}</Badge><Button size="icon-sm" variant="ghost" aria-label={`Hapus pola ${pattern.name}`} disabled={!canManage || remove.isPending} onClick={() => { if (window.confirm(`Hapus pola ${pattern.name}?`)) remove.mutate(pattern.id); }}><Trash2 className="size-4" /></Button></div></div>
        <div className="mt-3 flex flex-wrap gap-2">{pattern.days.map((dayItem) => <span key={dayItem.day_number} className={`rounded-md px-3 py-2 text-xs font-medium ${dayItem.work_schedule_id ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>{dayItem.day_number} · {dayItem.label || dayItem.work_schedule_code || "OFF"}</span>)}</div>
      </div>)}</CardContent></Card>
    </div>
  </Phase2Frame>;
}

function RosterPeriodsView({ permissions }: { permissions: string[] }) {
  const canManage = hasPermission(permissions, "roster.manage");
  const canPublish = hasPermission(permissions, "roster.publish");
  const client = useQueryClient();
  const periods = useQuery({ queryKey: ["roster-periods"], queryFn: () => apiFetchEnvelope<SchedulePeriod[]>("roster/periods?per_page=100&page=1") });
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState(""); const [scopeType, setScopeType] = useState<SchedulePeriod["scope_type"]>("tenant"); const [scopeId, setScopeId] = useState(""); const [notes, setNotes] = useState("");
  const save = useMutation({ mutationFn: () => apiFetch<SchedulePeriod>("roster/periods", { method: "POST", body: JSON.stringify({ code, name, start_date: startDate, end_date: endDate, scope_type: scopeType, scope_id: scopeType === "tenant" ? null : scopeId, notes: notes || null }) }), onSuccess: async () => { toast.success("Periode roster dibuat"); setCode(""); setName(""); await client.invalidateQueries({ queryKey: ["roster-periods"] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  const action = useMutation({ mutationFn: ({ id, verb }: { id: string; verb: "generate" | "publish" | "archive" }) => apiFetch<unknown>(`roster/periods/${id}/${verb}`, { method: "POST" }), onSuccess: async (_, variables) => { toast.success(variables.verb === "generate" ? "Roster berhasil dibuat" : variables.verb === "publish" ? "Roster dipublikasikan" : "Periode diarsipkan"); await client.invalidateQueries({ queryKey: ["roster-periods"] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  if (periods.isLoading) return <LoadingState label="Memuat periode roster" />;
  if (periods.isError) return <ErrorState message={getErrorMessage(periods.error)} retry={() => void periods.refetch()} />;
  const rows = periods.data?.data ?? [];
  const statusCount = (status: SchedulePeriod["status"]) => rows.filter((period) => period.status === status).length;
  return <Phase2Frame permissions={permissions} title="Periode Roster" description="Kelola jangka waktu roster; generate dari pola, lalu review dan publish.">
    <div className="grid gap-3 sm:grid-cols-3"><Stat label="Draft" value={statusCount("draft")} tone="amber" /><Stat label="Published" value={statusCount("published")} tone="emerald" /><Stat label="Archived" value={statusCount("archived")} tone="slate" /></div>
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]">
      <Card><CardHeader><CardTitle>Form Periode Roster</CardTitle><p className="text-xs text-muted-foreground">POST/PATCH /roster/periods · roster.manage</p></CardHeader><CardContent>{canManage ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
        <Field label="Kode *"><Input required value={code} onChange={(event) => setCode(event.target.value)} /></Field><Field label="Nama *"><Input required value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Tanggal mulai *"><Input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field><Field label="Tanggal akhir *"><Input required type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field></div>
        <Field label="Scope"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={scopeType} onChange={(event) => setScopeType(event.target.value as SchedulePeriod["scope_type"])}>{["tenant", "branch", "department", "group"].map((scope) => <option key={scope} value={scope}>{scope}</option>)}</select></Field>
        {scopeType !== "tenant" ? <Field label="Scope ID *"><Input required value={scopeId} onChange={(event) => setScopeId(event.target.value)} placeholder="ULID scope" /></Field> : null}
        <Field label="Catatan"><textarea className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        <p className="text-xs text-amber-700">Tanggal mulai ≤ tanggal akhir · periode tidak boleh tumpang tindih pada scope yang sama.</p><Button disabled={save.isPending}>{save.isPending ? "Menyimpan…" : "Buat Periode"}</Button>
      </form> : <p className="text-sm text-muted-foreground">Anda hanya memiliki akses lihat.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Daftar Periode Roster</CardTitle><p className="text-xs text-muted-foreground">GET /roster/periods · roster.view</p></CardHeader><CardContent className="space-y-3">
        {rows.length === 0 ? <EmptyState title="Belum ada periode roster" description="Buat periode agar roster dapat digenerate dan diterbitkan." /> : rows.map((period) => <div key={period.id} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{period.name}</p><Badge className={period.status === "published" ? "bg-emerald-50 text-emerald-700" : period.status === "draft" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}>{period.status === "published" ? "Published" : period.status === "draft" ? "Draft" : "Archived"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{period.code} · {formatRange(period.start_date, period.end_date)} · scope {period.scope_type}{period.scope_id ? ` · ${period.scope_id}` : ""}</p></div>
          <div className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={`/admin/scheduling/roster/${period.id}`}>Buka matriks<ArrowRight className="ml-1 size-3.5" /></Link></Button>{canManage && period.status === "draft" ? <><Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: period.id, verb: "generate" })}>Generate</Button><Button size="sm" disabled={action.isPending || !canPublish} onClick={() => action.mutate({ id: period.id, verb: "publish" })}>Publish</Button></> : null}{canManage && period.status === "published" ? <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: period.id, verb: "archive" })}>Arsipkan</Button> : null}</div>
        </div>)}
      </CardContent></Card>
    </div>
  </Phase2Frame>;
}

function RosterMatrixView({ periodId, permissions }: { periodId: string; permissions: string[] }) {
  const canManage = hasPermission(permissions, "roster.manage");
  const client = useQueryClient();
  const matrixQuery = useQuery({ queryKey: ["roster-matrix", periodId], queryFn: () => apiFetchEnvelope<RosterMatrix>(`roster/periods/${periodId}/matrix`), enabled: Boolean(periodId) });
  const [selectedSchedule, setSelectedSchedule] = useState<Record<string, string>>({});
  const schedules = useQuery({ queryKey: ["work-schedules"], queryFn: () => apiFetchEnvelope<WorkSchedule[]>("schedules") });
  const saveCell = useMutation({ mutationFn: ({ employeeId, date, scheduleId }: { employeeId: string; date: string; scheduleId: string | null }) => {
    return apiFetch<unknown>(`roster/periods/${periodId}/entries/bulk`, { method: "POST", body: JSON.stringify({ entries: [{ employee_id: employeeId, date, work_schedule_id: scheduleId }] }) });
  }, onSuccess: async () => { toast.success("Jadwal roster diperbarui"); await client.invalidateQueries({ queryKey: ["roster-matrix", periodId] }); }, onError: async (error) => { setSelectedSchedule({}); toast.error(getErrorMessage(error)); await client.invalidateQueries({ queryKey: ["roster-matrix", periodId] }); } });
  const action = useMutation({ mutationFn: (verb: "generate" | "publish") => apiFetch<unknown>(`roster/periods/${periodId}/${verb}`, { method: "POST" }), onSuccess: async (_, verb) => { toast.success(verb === "generate" ? "Roster digenerate" : "Roster dipublikasikan"); await client.invalidateQueries({ queryKey: ["roster-matrix", periodId] }); await client.invalidateQueries({ queryKey: ["roster-periods"] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  if (!periodId) return <ErrorState message="ID periode roster tidak valid." />;
  if (matrixQuery.isLoading) return <LoadingState label="Memuat matriks roster" />;
  if (matrixQuery.isError || !matrixQuery.data?.data) return <ErrorState message={getErrorMessage(matrixQuery.error)} retry={() => void matrixQuery.refetch()} />;
  const matrix = matrixQuery.data.data;
  const canOverridePublished = hasPermission(permissions, "roster.override_published");
  const canEditMatrix = canManage && matrix.period.status !== "archived" && (matrix.period.status !== "published" || canOverridePublished);
  const exportHref = `/api/proxy/roster/periods/${periodId}/export`;
  return <Phase2Frame permissions={permissions} title="Matriks Roster" description="Tinjau dan ubah jadwal per karyawan dan tanggal.">
    <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{matrix.period.name}</h2><Badge className={matrix.period.status === "published" ? "bg-emerald-50 text-emerald-700" : matrix.period.status === "draft" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"}>{matrix.period.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{formatRange(matrix.period.start_date, matrix.period.end_date)} · scope {matrix.period.scope_type}</p></div><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><a href={exportHref}><Download className="mr-2 size-4" />Export</a></Button>{canManage && matrix.period.status === "draft" ? <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate("generate")}><RefreshCw className="mr-2 size-4" />Generate</Button> : null}{hasPermission(permissions, "roster.publish") && matrix.period.status === "draft" ? <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={action.isPending} onClick={() => action.mutate("publish")}>Publish Roster</Button> : null}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>Roster · {matrix.period.code}</CardTitle><p className="text-xs text-muted-foreground">P = shift kerja · OFF = tidak dijadwalkan · perubahan dicatat ke schedule logs.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-sm"><thead><tr className="bg-muted/50 text-xs text-muted-foreground"><th className="sticky left-0 z-10 min-w-48 bg-muted/50 px-4 py-3 text-left">Karyawan</th>{matrix.dates.map((date) => <th key={date} className="min-w-24 px-2 py-3">{new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short" }).format(new Date(`${date}T00:00:00`))}</th>)}</tr></thead><tbody>{matrix.employees.map((employee) => <tr key={employee.id} className="border-t"><th className="sticky left-0 z-10 bg-card px-4 py-3 text-left font-medium">{employee.name}<span className="mt-0.5 block text-xs font-normal text-muted-foreground">{employee.employee_number}</span></th>{matrix.dates.map((date) => {
            const entry = matrix.entries.find((item) => item.employee_id === employee.id && item.date === date);
            const currentId = entry?.work_schedule_id ?? "";
            const key = `${employee.id}:${date}`;
            return <td key={date} className="border-l px-2 py-2 text-center"><select aria-label={`${employee.name} ${date}`} className={`h-8 w-full min-w-20 rounded-md border-0 px-1 text-center text-xs font-semibold ${currentId ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`} disabled={!canEditMatrix || !entry} value={selectedSchedule[key] ?? currentId} onChange={(event) => {
              const value = event.target.value;
              setSelectedSchedule((current) => ({ ...current, [key]: value }));
              if (entry) saveCell.mutate({ employeeId: employee.id, date, scheduleId: value || null });
            }}><option value="">OFF</option>{(schedules.data?.data ?? []).map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.code}</option>)}</select></td>;
          })}</tr>)}</tbody></table></div><p className="border-t p-4 text-xs text-muted-foreground">{matrix.period.status === "published" && !canOverridePublished ? "Roster published bersifat read-only; diperlukan permission roster.override_published untuk mengubahnya." : "Setiap perubahan disimpan melalui API roster dan dicatat pada schedule logs."}</p></CardContent></Card>
  </Phase2Frame>;
}

function MinimumPersonnelView({ permissions }: { permissions: string[] }) {
  const canManage = hasPermission(permissions, "roster.manage");
  const client = useQueryClient();
  const rules = useQuery({ queryKey: ["min-personnel"], queryFn: () => apiFetchEnvelope<MinPersonnelRule[]>("roster/min-personnel") });
  const schedules = useQuery({ queryKey: ["work-schedules"], queryFn: () => apiFetchEnvelope<WorkSchedule[]>("schedules") });
  const [scopeType, setScopeType] = useState<MinPersonnelRule["scope_type"]>("tenant"); const [scopeId, setScopeId] = useState(""); const [day, setDay] = useState(""); const [scheduleId, setScheduleId] = useState(""); const [minCount, setMinCount] = useState("1");
  const save = useMutation({ mutationFn: () => apiFetch<MinPersonnelRule>("roster/min-personnel", { method: "POST", body: JSON.stringify({ scope_type: scopeType, scope_id: scopeType === "tenant" ? null : scopeId, day_of_week: day ? Number(day) : null, work_schedule_id: scheduleId || null, min_count: Number(minCount) }) }), onSuccess: async () => { toast.success("Aturan minimum personel dibuat"); await client.invalidateQueries({ queryKey: ["min-personnel"] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  const remove = useMutation({ mutationFn: (id: string) => apiFetch<null>(`roster/min-personnel/${id}`, { method: "DELETE" }), onSuccess: async () => { toast.success("Aturan dihapus"); await client.invalidateQueries({ queryKey: ["min-personnel"] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  if (rules.isLoading) return <LoadingState label="Memuat aturan minimum personel" />;
  if (rules.isError) return <ErrorState message={getErrorMessage(rules.error)} retry={() => void rules.refetch()} />;
  return <Phase2Frame permissions={permissions} title="Minimum Personel" description="Tetapkan kebutuhan minimum karyawan pada scope dan jadwal tertentu.">
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.2fr)]"><Card><CardHeader><CardTitle>Aturan Minimum Personel</CardTitle></CardHeader><CardContent>{canManage ? <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <Field label="Scope type"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={scopeType} onChange={(event) => setScopeType(event.target.value as MinPersonnelRule["scope_type"])}>{["tenant", "branch", "department", "group", "employee"].map((type) => <option key={type} value={type}>{type}</option>)}</select></Field>
      {scopeType !== "tenant" ? <Field label="Scope ID"><Input required value={scopeId} onChange={(event) => setScopeId(event.target.value)} placeholder="ULID scope" /></Field> : null}
      <Field label="Jadwal"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={scheduleId} onChange={(event) => setScheduleId(event.target.value)}><option value="">Semua jadwal</option>{(schedules.data?.data ?? []).map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.code} · {schedule.name}</option>)}</select></Field>
      <Field label="Hari (opsional)"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={day} onChange={(event) => setDay(event.target.value)}><option value="">Semua hari</option>{["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"].map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></Field>
      <Field label="Jumlah minimum"><Input type="number" min="1" required value={minCount} onChange={(event) => setMinCount(event.target.value)} /></Field><Button disabled={save.isPending}>{save.isPending ? "Menyimpan…" : "Simpan Aturan"}</Button>
    </form> : <p className="text-sm text-muted-foreground">Anda hanya memiliki akses lihat.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Daftar Aturan</CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm"><thead><tr className="bg-muted/50 text-left text-xs text-muted-foreground"><th className="px-4 py-3">Scope</th><th className="px-4 py-3">Hari</th><th className="px-4 py-3">Jadwal</th><th className="px-4 py-3">Minimum</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Aksi</th></tr></thead><tbody>{(rules.data?.data ?? []).map((rule) => <tr key={rule.id} className="border-t"><td className="px-4 py-3">{rule.scope_type} · {rule.scope_id ?? "tenant"}</td><td className="px-4 py-3">{weekday(rule.day_of_week)}</td><td className="px-4 py-3">{(schedules.data?.data ?? []).find((schedule) => schedule.id === rule.work_schedule_id)?.code ?? "Semua"}</td><td className="px-4 py-3 font-semibold">{rule.min_count}</td><td className="px-4 py-3">{rule.is_active ? "Aktif" : "Nonaktif"}</td><td className="px-4 py-3"><Button variant="ghost" size="icon-sm" aria-label="Hapus aturan" disabled={!canManage || remove.isPending} onClick={() => { if (window.confirm("Hapus aturan minimum personel ini?")) remove.mutate(rule.id); }}><Trash2 className="size-4" /></Button></td></tr>)}</tbody></table></div>{(rules.data?.data ?? []).length === 0 ? <div className="p-5"><EmptyState title="Belum ada aturan" description="Tambahkan minimum personel agar roster dapat divalidasi sebelum publish." /></div> : null}</CardContent></Card></div>
  </Phase2Frame>;
}

function ShiftSwapsView({ permissions }: { permissions: string[] }) {
  const canApprove = hasPermission(permissions, "shift_swap.approve"); const client = useQueryClient();
  const swaps = useQuery({ queryKey: ["shift-swaps"], queryFn: () => apiFetchEnvelope<ShiftSwap[]>("shift-swaps?per_page=100&page=1") });
  const action = useMutation({ mutationFn: ({ id, verb }: { id: string; verb: "approve" | "accept" | "reject" }) => apiFetch<ShiftSwap>(`shift-swaps/${id}/${verb}`, { method: "POST" }), onSuccess: async (_, variables) => { toast.success(variables.verb === "approve" ? "Tukar shift disetujui" : variables.verb === "accept" ? "Permintaan diterima" : "Permintaan ditolak"); await client.invalidateQueries({ queryKey: ["shift-swaps"] }); }, onError: (error) => toast.error(getErrorMessage(error)) });
  if (swaps.isLoading) return <LoadingState label="Memuat permintaan tukar shift" />;
  if (swaps.isError) return <ErrorState message={getErrorMessage(swaps.error)} retry={() => void swaps.refetch()} />;
  const rows = swaps.data?.data ?? [];
  return <Phase2Frame permissions={permissions} title="Tukar Shift" description="Pantau permintaan pertukaran jadwal antar karyawan.">
    <Card><CardHeader><CardTitle>Daftar Permintaan</CardTitle><p className="text-xs text-muted-foreground">Permintaan dibuat dan diterima oleh karyawan terkait; approval membutuhkan shift_swap.approve.</p></CardHeader><CardContent className="space-y-3">{rows.length === 0 ? <EmptyState title="Belum ada permintaan tukar shift" description="Permintaan karyawan akan muncul di sini." /> : rows.map((swap) => <div key={swap.id} className="flex flex-col gap-3 rounded-xl border p-4 md:flex-row md:items-center"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{swap.requester?.full_name ?? swap.requester_employee_id} <span className="font-normal text-muted-foreground">⇄</span> {swap.target?.full_name ?? swap.target_employee_id}</p><Badge variant={swap.status === "approved" ? "secondary" : "outline"}>{swap.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{formatDate(swap.requester_date)} ↔ {formatDate(swap.target_date)}{swap.reason ? ` · ${swap.reason}` : ""}</p></div>{canApprove && swap.status === "peer_accepted" ? <Button size="sm" disabled={action.isPending} onClick={() => action.mutate({ id: swap.id, verb: "approve" })}>Setujui tukar shift</Button> : null}</div>)}</CardContent></Card>
  </Phase2Frame>;
}

function Phase2Frame({ permissions, title, description, children }: { permissions: string[]; title: string; description: string; children: React.ReactNode }) {
  return <div className="space-y-5"><PageHeader eyebrow="Operasional · Penjadwalan" title={title} description={description} /><Phase2Navigation permissions={permissions} />{children}</div>;
}

function Stat({ label, value, tone = "blue" }: { label: string; value: number; tone?: "blue" | "amber" | "emerald" | "slate" }) {
  const color = { blue: "text-blue-700", amber: "text-amber-700", emerald: "text-emerald-700", slate: "text-slate-600" }[tone];
  return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p></CardContent></Card>;
}

function Field({ label, children, error }: { label: string; children: React.ReactNode; error?: string }) { return <label className="block space-y-1.5 text-sm"><span className="font-medium">{label}</span>{children}{error ? <span role="alert" className="block text-xs font-medium text-destructive">{error}</span> : null}</label>; }

function calculateSchedule(form: { start_time: string; end_time: string; break_enabled: boolean; break_start: string; break_end: string }) {
  if (!isTimeValue(form.start_time) || !isTimeValue(form.end_time)) return { valid: false, crossDay: false, grossMinutes: 0, breakMinutes: 0, netMinutes: 0, error: "Isi jam mulai dan jam selesai dengan benar untuk menghitung durasi shift." };
  const start = timeToMinutes(form.start_time);
  const end = timeToMinutes(form.end_time);
  const crossDay = end <= start;
  const adjustedEnd = crossDay ? end + 1440 : end;
  const grossMinutes = adjustedEnd - start;
  let breakMinutes = 0;

  if (form.break_enabled) {
    if (!isTimeValue(form.break_start) || !isTimeValue(form.break_end)) return { valid: false, crossDay, grossMinutes, breakMinutes: 0, netMinutes: grossMinutes, error: "Isi waktu mulai dan selesai istirahat, atau nonaktifkan istirahat." };
    let breakStart = timeToMinutes(form.break_start);
    let breakEnd = timeToMinutes(form.break_end);
    if (breakEnd < breakStart) breakEnd += 1440;
    if (breakStart < start) {
      breakStart += 1440;
      breakEnd += 1440;
    }
    if (breakEnd <= breakStart) return { valid: false, crossDay, grossMinutes, breakMinutes: 0, netMinutes: grossMinutes, error: "Durasi istirahat harus lebih dari 0 menit." };
    if (breakStart < start || breakEnd > adjustedEnd) return { valid: false, crossDay, grossMinutes, breakMinutes: breakEnd - breakStart, netMinutes: grossMinutes - (breakEnd - breakStart), error: "Waktu istirahat harus berada sepenuhnya di dalam rentang shift." };
    breakMinutes = breakEnd - breakStart;
  }

  const netMinutes = grossMinutes - breakMinutes;
  if (grossMinutes <= 0 || netMinutes <= 0) return { valid: false, crossDay, grossMinutes, breakMinutes, netMinutes, error: "Hasil durasi kerja bersih harus lebih dari 0 menit. Periksa jam shift dan istirahat." };
  return { valid: true, crossDay, grossMinutes, breakMinutes, netMinutes, error: "" };
}

function validateSchedule(form: { code: string; name: string; start_time: string; end_time: string; break_enabled: boolean; break_start: string; break_end: string; notes: string }) {
  const errors: Record<string, string> = {};
  if (!form.code.trim()) errors.code = "Kode jadwal wajib diisi.";
  else if (form.code.trim().length > 20) errors.code = "Kode maksimal 20 karakter.";
  else if (!/^[A-Za-z0-9._-]+$/.test(form.code.trim())) errors.code = "Kode hanya boleh berisi huruf, angka, titik, garis bawah, dan tanda hubung.";
  if (form.name.trim().length < 2) errors.name = "Nama jadwal minimal 2 karakter.";
  else if (form.name.trim().length > 100) errors.name = "Nama jadwal maksimal 100 karakter.";
  if (!isTimeValue(form.start_time)) errors.start_time = "Jam mulai wajib diisi dengan format waktu yang valid.";
  if (!isTimeValue(form.end_time)) errors.end_time = "Jam selesai wajib diisi dengan format waktu yang valid.";
  if (form.notes.length > 255) errors.notes = "Catatan maksimal 255 karakter.";
  const calculation = calculateSchedule(form);
  if (form.break_enabled && isTimeValue(form.start_time) && isTimeValue(form.end_time) && calculation.error) {
    if (!isTimeValue(form.break_start)) errors.break_start = "Jam mulai istirahat wajib diisi.";
    else if (!isTimeValue(form.break_end)) errors.break_end = "Jam selesai istirahat wajib diisi.";
    else errors.break_start = calculation.error;
  }
  return errors;
}

function isTimeValue(value: string) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function timeToMinutes(value: string) { const [hours, minutes] = value.split(":").map(Number); return hours * 60 + minutes; }
function formatHours(minutes: number) { return `${Math.floor(minutes / 60)} jam${minutes % 60 ? ` ${minutes % 60} menit` : ""}`; }

function EffectiveDetails({ data, employee }: { data: unknown; employee?: Employee }) {
  const value = data as { date?: string; source?: string; start_at?: string | null; end_at?: string | null; work_schedule?: WorkSchedule | null };
  return <dl className="grid gap-3 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-2"><Info label="Karyawan" value={employee?.full_name ?? "—"} /><Info label="Tanggal" value={value.date ?? "—"} /><Info label="Sumber" value={value.source ?? "—"} /><Info label="Shift" value={value.work_schedule ? `${value.work_schedule.code} · ${value.work_schedule.start_time}–${value.work_schedule.end_time}` : "OFF"} /><Info label="Waktu" value={value.start_at && value.end_at ? `${formatDateTime(value.start_at)} → ${formatDateTime(value.end_at)}` : "—"} /></dl>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>; }
function weekday(value: number | null) { return value ? ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"][value - 1] ?? "—" : "Semua hari"; }
function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value}T00:00:00`)); }
function formatRange(start: string, end: string) { return `${formatDate(start)} – ${formatDate(end)}`; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
