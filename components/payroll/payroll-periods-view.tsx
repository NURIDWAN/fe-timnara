"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarPlus, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { apiFetch, apiFetchEnvelope, getPagination } from "@/lib/api/client";
import type { PayrollPeriod, PayrollPeriodAssignment, StorePayrollPeriodRequest } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";
import { EmployeeSelect, Field, PayrollShell, formatDate, useEmployeeList } from "@/components/payroll/payroll-shared";

type PeriodForm = StorePayrollPeriodRequest & { is_active: boolean };

const emptyForm: PeriodForm = {
  code: "",
  name: "",
  start_day: 1,
  end_day: 31,
  cross_month_method: "same_month",
  is_semi_monthly: false,
  term_1_from: null,
  term_1_to: null,
  term_1_portion: null,
  term_2_from: null,
  term_2_to: null,
  term_2_portion: null,
  is_active: true,
};

export function PayrollPeriodsView({ permissions }: { permissions: string[] }) {
  if (!hasPermission(permissions, "payroll.view")) return <UnauthorizedState />;
  return <PayrollShell permissions={permissions} current="/admin/payroll/periods" title="Periode Payroll" description="Kelola periode, termin semi-monthly, penugasan karyawan, dan mutasi periode."><PeriodsContent permissions={permissions} /></PayrollShell>;
}

function PeriodsContent({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const canManage = hasPermission(permissions, "payroll.manage");
  const canViewEmployees = hasPermission(permissions, "employee.view");
  const [form, setForm] = useState<PeriodForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [selectedPeriodId, setSelectedPeriodId] = useState("");

  const periods = useQuery({ queryKey: ["payroll-periods", "all"], queryFn: () => apiFetchEnvelope<PayrollPeriod[]>("payroll/periods?per_page=100&page=1") });
  const employees = useEmployeeList(canViewEmployees);
  const assignments = useQuery({ queryKey: ["payroll-period-assignments", selectedPeriodId], queryFn: () => apiFetchEnvelope<PayrollPeriodAssignment[]>(`payroll/periods/${selectedPeriodId}/assignments?per_page=100`), enabled: Boolean(selectedPeriodId) });

  const save = useMutation({
    mutationFn: (payload: PeriodForm) => editingId
      ? apiFetch<PayrollPeriod>(`payroll/periods/${editingId}`, { method: "PATCH", body: JSON.stringify(payload) })
      : apiFetch<PayrollPeriod>("payroll/periods", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async (period) => {
      toast.success(editingId ? "Periode payroll diperbarui" : "Periode payroll dibuat");
      setForm(emptyForm);
      setEditingId(null);
      setFieldErrors({});
      if (!selectedPeriodId) setSelectedPeriodId(period.id);
      await client.invalidateQueries({ queryKey: ["payroll-periods"] });
      await client.invalidateQueries({ queryKey: ["payroll-period-assignments"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<null>(`payroll/periods/${id}`, { method: "DELETE" }),
    onSuccess: async (_data, id) => {
      toast.success("Periode payroll dihapus");
      if (selectedPeriodId === id) setSelectedPeriodId("");
      await client.invalidateQueries({ queryKey: ["payroll-periods"] });
      await client.invalidateQueries({ queryKey: ["payroll-period-assignments"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  function edit(period: PayrollPeriod) {
    setEditingId(period.id);
    setForm({
      code: period.code,
      name: period.name,
      start_day: period.start_day,
      end_day: period.end_day,
      cross_month_method: period.cross_month_method,
      is_semi_monthly: period.is_semi_monthly,
      term_1_from: period.term_1_from ?? null,
      term_1_to: period.term_1_to ?? null,
      term_1_portion: period.term_1_portion ?? null,
      term_2_from: period.term_2_from ?? null,
      term_2_to: period.term_2_to ?? null,
      term_2_portion: period.term_2_portion ?? null,
      is_active: period.is_active,
    });
    setFieldErrors({});
  }

  function submit() {
    const errors: Record<string, string> = {};
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(form.code)) errors.code = "Kode 1–20 karakter, hanya huruf, angka, garis bawah, atau tanda hubung.";
    if (form.name.trim().length < 2) errors.name = "Nama minimal 2 karakter.";
    if (form.start_day < 1 || form.start_day > 31) errors.start_day = "Hari awal 1–31.";
    if (form.end_day < 1 || form.end_day > 31) errors.end_day = "Hari akhir 1–31.";
    if (form.start_day > form.end_day && form.cross_month_method === "same_month") errors.end_day = "Hari akhir tidak boleh sebelum hari awal pada metode same_month.";
    if (form.is_semi_monthly) {
      for (const key of ["term_1_from", "term_1_to", "term_1_portion", "term_2_from", "term_2_to", "term_2_portion"] as const) {
        if (form[key] === null || form[key] === undefined || String(form[key]).length === 0) errors[key] = "Wajib diisi untuk periode semi-monthly.";
      }
      if (((form.term_1_portion ?? 0) + (form.term_2_portion ?? 0)) !== 100) errors.term_2_portion = "Total porsi termin 1 dan 2 harus 100.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) save.mutate(form);
  }

  if (periods.isLoading) return <LoadingState label="Memuat periode payroll" />;
  if (periods.isError) return <ErrorState message={getErrorMessage(periods.error)} retry={() => void periods.refetch()} />;
  const rows = periods.data?.data ?? [];

  return <div className="flex flex-col gap-4">
    <div className="grid gap-4 xl:grid-cols-[400px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader><CardTitle>{editingId ? "Edit Periode Payroll" : "Tambah Periode Payroll"}</CardTitle><CardDescription>Aturan lintas bulan dan termin mengikuti validasi API.</CardDescription></CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Kode *" error={fieldErrors.code}><Input aria-invalid={Boolean(fieldErrors.code)} maxLength={20} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="PG-01" /></Field>
              <Field label="Nama *" error={fieldErrors.name}><Input aria-invalid={Boolean(fieldErrors.name)} maxLength={100} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Bulanan 1–31" /></Field>
              <Field label="Hari awal *" error={fieldErrors.start_day}><Input aria-invalid={Boolean(fieldErrors.start_day)} type="number" min="1" max="31" value={form.start_day} onChange={(event) => setForm((current) => ({ ...current, start_day: Number(event.target.value) }))} /></Field>
              <Field label="Hari akhir *" error={fieldErrors.end_day}><Input aria-invalid={Boolean(fieldErrors.end_day)} type="number" min="1" max="31" value={form.end_day} onChange={(event) => setForm((current) => ({ ...current, end_day: Number(event.target.value) }))} /></Field>
            </div>
            <Field label="Metode lintas bulan"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.cross_month_method} onChange={(event) => setForm((current) => ({ ...current, cross_month_method: event.target.value as PeriodForm["cross_month_method"] }))}><option value="same_month">same_month — dalam satu bulan</option><option value="previous_to_current">previous_to_current — bulan lalu ke bulan ini</option><option value="current_to_next">current_to_next — bulan ini ke bulan depan</option></select></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={form.is_semi_monthly} onChange={(event) => setForm((current) => event.target.checked ? { ...current, is_semi_monthly: true } : { ...current, is_semi_monthly: false, term_1_from: null, term_1_to: null, term_1_portion: null, term_2_from: null, term_2_to: null, term_2_portion: null })} />Periode semi-monthly</label>
            {form.is_semi_monthly ? <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/30 p-3"><Field label="Term 1 dari" error={fieldErrors.term_1_from}><Input type="number" min="1" max="31" value={form.term_1_from ?? ""} onChange={(event) => setForm((current) => ({ ...current, term_1_from: event.target.value === "" ? null : Number(event.target.value) }))} /></Field><Field label="Sampai" error={fieldErrors.term_1_to}><Input type="number" min="1" max="31" value={form.term_1_to ?? ""} onChange={(event) => setForm((current) => ({ ...current, term_1_to: event.target.value === "" ? null : Number(event.target.value) }))} /></Field><Field label="Porsi %" error={fieldErrors.term_1_portion}><Input type="number" min="0" max="100" step="0.01" value={form.term_1_portion ?? ""} onChange={(event) => setForm((current) => ({ ...current, term_1_portion: event.target.value === "" ? null : Number(event.target.value) }))} /></Field><Field label="Term 2 dari" error={fieldErrors.term_2_from}><Input type="number" min="1" max="31" value={form.term_2_from ?? ""} onChange={(event) => setForm((current) => ({ ...current, term_2_from: event.target.value === "" ? null : Number(event.target.value) }))} /></Field><Field label="Sampai" error={fieldErrors.term_2_to}><Input type="number" min="1" max="31" value={form.term_2_to ?? ""} onChange={(event) => setForm((current) => ({ ...current, term_2_to: event.target.value === "" ? null : Number(event.target.value) }))} /></Field><Field label="Porsi %" error={fieldErrors.term_2_portion}><Input type="number" min="0" max="100" step="0.01" value={form.term_2_portion ?? ""} onChange={(event) => setForm((current) => ({ ...current, term_2_portion: event.target.value === "" ? null : Number(event.target.value) }))} /></Field></div> : null}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={form.is_active} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />Periode aktif</label>
            <div className="flex gap-2"><Button type="submit" disabled={!canManage || save.isPending}>{editingId ? "Simpan Perubahan" : "Tambah Periode"}</Button>{editingId ? <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyForm); setFieldErrors({}); }}>Batal</Button> : null}</div>
            {!canManage ? <p className="text-sm text-muted-foreground">Permission <code className="rounded bg-muted px-1">payroll.manage</code> diperlukan untuk mengubah periode.</p> : null}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Daftar Periode</CardTitle><CardDescription>{getPagination(periods.data?.meta ?? {})?.total ?? rows.length} periode ditemukan.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void periods.refetch()}><RefreshCw data-icon="inline-start" />Muat ulang</Button></CardHeader>
        <CardContent>
          {rows.length === 0 ? <EmptyState title="Belum ada periode payroll" description="Tambahkan periode sebelum membuat payroll run." /> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-4 font-medium">Kode</th><th className="py-3 pr-4 font-medium">Nama</th><th className="py-3 pr-4 font-medium">Rentang</th><th className="py-3 pr-4 font-medium">Termin</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 font-medium">Aksi</th></tr></thead><tbody className="divide-y">{rows.map((period) => <tr key={period.id}><td className="py-3 pr-4 font-medium">{period.code}</td><td className="py-3 pr-4">{period.name}</td><td className="py-3 pr-4 text-muted-foreground">{period.start_day}–{period.end_day} · {period.cross_month_method}</td><td className="py-3 pr-4 text-muted-foreground">{period.is_semi_monthly ? `${period.term_1_portion ?? 0}% / ${period.term_2_portion ?? 0}%` : "Bulanan"}</td><td className="py-3 pr-4"><Badge variant={period.is_active ? "secondary" : "outline"}>{period.is_active ? "Aktif" : "Nonaktif"}</Badge></td><td className="py-3"><div className="flex flex-wrap gap-1.5"><Button size="sm" variant="outline" onClick={() => setSelectedPeriodId(period.id)}><CalendarPlus data-icon="inline-start" />Assignment</Button>{canManage ? <Button size="sm" variant="ghost" aria-label={`Edit ${period.code}`} onClick={() => edit(period)}><Pencil /></Button> : null}{canManage ? <Button size="sm" variant="ghost" aria-label={`Hapus ${period.code}`} onClick={() => { if (window.confirm(`Hapus periode ${period.code}?`)) remove.mutate(period.id); }}><Trash2 /></Button> : null}</div></td></tr>)}</tbody></table></div>}
        </CardContent>
      </Card>
    </div>

    <AssignmentsSection periodId={selectedPeriodId} periods={rows} employees={employees.data?.data ?? []} canManage={canManage} canViewEmployees={canViewEmployees} assignments={assignments.data?.data ?? []} isLoading={assignments.isLoading} isError={assignments.isError} error={assignments.error} onRetry={() => void assignments.refetch()} onSelectPeriod={setSelectedPeriodId} />
  </div>;
}

function AssignmentsSection({ periodId, periods, employees, canManage, canViewEmployees, assignments, isLoading, isError, error, onRetry, onSelectPeriod }: { periodId: string; periods: PayrollPeriod[]; employees: import("@/lib/api/types").Employee[]; canManage: boolean; canViewEmployees: boolean; assignments: PayrollPeriodAssignment[]; isLoading: boolean; isError: boolean; error: unknown; onRetry: () => void; onSelectPeriod: (id: string) => void }) {
  const client = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [mutateEmployeeId, setMutateEmployeeId] = useState("");
  const [mutatePeriodId, setMutatePeriodId] = useState(periodId);
  const [mutateStart, setMutateStart] = useState("");

  useEffect(() => {
    if (periodId) setMutatePeriodId(periodId);
  }, [periodId]);

  const add = useMutation({
    mutationFn: () => apiFetch<PayrollPeriodAssignment>(`payroll/periods/${periodId}/assignments`, { method: "POST", body: JSON.stringify({ employee_id: employeeId, start_date: startDate, end_date: endDate || null, is_active: true }) }),
    onSuccess: async () => { toast.success("Penugasan periode dibuat; assignment aktif sebelumnya ditutup oleh API."); setEmployeeId(""); setStartDate(""); setEndDate(""); await client.invalidateQueries({ queryKey: ["payroll-period-assignments"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const mutate = useMutation({
    mutationFn: () => apiFetch<PayrollPeriodAssignment>("payroll/periods/mutate", { method: "POST", body: JSON.stringify({ employee_id: mutateEmployeeId, payroll_period_id: mutatePeriodId, start_date: mutateStart }) }),
    onSuccess: async () => { toast.success("Periode karyawan dimutasi; histori lama tetap tersimpan."); setMutateEmployeeId(""); setMutateStart(""); await client.invalidateQueries({ queryKey: ["payroll-period-assignments"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  return <Card>
    <CardHeader><CardTitle>Assignment & Mutasi Periode</CardTitle><CardDescription>Assignment baru untuk karyawan akan menutup assignment aktif sebelumnya secara efektif.</CardDescription></CardHeader>
    <CardContent className="flex flex-col gap-5">
      <Field label="Pilih periode untuk melihat assignment"><select className="h-10 w-full max-w-md rounded-lg border bg-background px-3 text-sm" value={periodId} onChange={(event) => onSelectPeriod(event.target.value)}><option value="">Pilih periode</option>{periods.map((period) => <option key={period.id} value={period.id}>{period.code} · {period.name}</option>)}</select></Field>
      {!periodId ? <p className="text-sm text-muted-foreground">Pilih periode pada tabel atau dropdown untuk melihat penugasan.</p> : isLoading ? <LoadingState label="Memuat assignment" /> : isError ? <ErrorState message={getErrorMessage(error)} retry={onRetry} /> : <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 pr-4 font-medium">Karyawan</th><th className="py-2 pr-4 font-medium">Periode</th><th className="py-2 pr-4 font-medium">Mulai</th><th className="py-2 pr-4 font-medium">Selesai</th><th className="py-2 font-medium">Status</th></tr></thead><tbody className="divide-y">{assignments.length === 0 ? <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Belum ada assignment untuk periode ini.</td></tr> : assignments.map((item) => <tr key={item.id}><td className="py-2 pr-4 font-medium">{item.employee?.full_name ?? item.employee_id}{item.employee?.employee_number ? <span className="block text-xs font-normal text-muted-foreground">{item.employee.employee_number}</span> : null}</td><td className="py-2 pr-4">{item.period?.code ?? item.payroll_period_id}</td><td className="py-2 pr-4">{formatDate(item.start_date)}</td><td className="py-2 pr-4">{formatDate(item.end_date)}</td><td className="py-2"><Badge variant={item.is_active ? "secondary" : "outline"}>{item.is_active ? "Aktif" : "Ditutup"}</Badge></td></tr>)}</tbody></table></div>}

      {canManage && periodId ? <div className="grid gap-4 lg:grid-cols-2">
        <form className="rounded-xl border p-4" onSubmit={(event) => { event.preventDefault(); add.mutate(); }}>
          <h3 className="font-semibold">Tambah Assignment</h3>
          <p className="mb-3 text-xs text-muted-foreground">POST /payroll/periods/{"{id}"}/assignments</p>
          <div className="flex flex-col gap-3">
            <Field label="Karyawan *">{canViewEmployees && employees.length > 0 ? <EmployeeSelect employees={employees} value={employeeId} onChange={setEmployeeId} required /> : <Input required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="ULID karyawan" />}</Field>
            <div className="grid grid-cols-2 gap-3"><Field label="Mulai *"><Input required type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></Field><Field label="Selesai"><Input type="date" min={startDate || undefined} value={endDate} onChange={(event) => setEndDate(event.target.value)} /></Field></div>
            <Button type="submit" disabled={add.isPending || !employeeId || !startDate}>Tambah Assignment</Button>
          </div>
        </form>
        <form className="rounded-xl border p-4" onSubmit={(event) => { event.preventDefault(); mutate.mutate(); }}>
          <h3 className="font-semibold">Mutasi Periode Karyawan</h3>
          <p className="mb-3 text-xs text-muted-foreground">POST /payroll/periods/mutate · assignment lama ditutup efektif.</p>
          <div className="flex flex-col gap-3">
            <Field label="Karyawan *">{canViewEmployees && employees.length > 0 ? <EmployeeSelect employees={employees} value={mutateEmployeeId} onChange={setMutateEmployeeId} required /> : <Input required value={mutateEmployeeId} onChange={(event) => setMutateEmployeeId(event.target.value)} placeholder="ULID karyawan" />}</Field>
            <Field label="Periode tujuan *"><select required className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={mutatePeriodId} onChange={(event) => setMutatePeriodId(event.target.value)}><option value="">Pilih periode</option>{periods.map((period) => <option key={period.id} value={period.id}>{period.code} · {period.name}</option>)}</select></Field>
            <Field label="Tanggal mulai *"><Input required type="date" value={mutateStart} onChange={(event) => setMutateStart(event.target.value)} /></Field>
            <Button type="submit" disabled={mutate.isPending || !mutateEmployeeId || !mutatePeriodId || !mutateStart}>Mutasi Periode</Button>
          </div>
        </form>
      </div> : null}
    </CardContent>
  </Card>;
}
