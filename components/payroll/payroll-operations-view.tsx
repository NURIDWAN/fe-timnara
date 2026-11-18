"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, LockOpen, Plus, RefreshCw, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { apiFetch, apiFetchEnvelope, getPagination } from "@/lib/api/client";
import type { OvertimeRequest, PayrollLock, PayrollRun, SalaryAdjustment, SalaryComponent, StoreOvertimeRequestRequest, StoreSalaryAdjustmentRequest, StoreSupplementaryRunRequest, SupplementaryRun } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";
import { EmployeeSelect, Field, PayrollShell, StatusBadge, formatDate, formatDateTime, formatRupiah, useEmployeeList } from "@/components/payroll/payroll-shared";

export function PayrollOvertimeView({ permissions }: { permissions: string[] }) {
  if (!hasPermission(permissions, "payroll.view")) return <UnauthorizedState />;
  return <PayrollShell permissions={permissions} current="/admin/payroll/overtime" title="Lembur" description="Pengajuan lembur, keputusan approver, dan jendela lembur yang disetujui."><OvertimeContent permissions={permissions} /></PayrollShell>;
}

function OvertimeContent({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const canApprove = hasPermission(permissions, "overtime.approve");
  const canCreateForOthers = hasPermission(permissions, "payroll.manage");
  const canViewEmployees = hasPermission(permissions, "employee.view");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [note, setNote] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [date, setDate] = useState("");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [reason, setReason] = useState("");
  const params = new URLSearchParams({ per_page: "50", page: "1" });
  if (status) params.set("status", status);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);

  const employees = useEmployeeList(canViewEmployees && canCreateForOthers);
  const query = useQuery({ queryKey: ["payroll-overtime", status, dateFrom, dateTo], queryFn: () => apiFetchEnvelope<OvertimeRequest[]>(`payroll/overtime-requests?${params}`) });

  const create = useMutation({
    mutationFn: () => apiFetch<OvertimeRequest>("payroll/overtime-requests", { method: "POST", body: JSON.stringify({ ...(employeeId ? { employee_id: employeeId } : {}), date, planned_start: plannedStart, planned_end: plannedEnd, reason: reason || null } satisfies StoreOvertimeRequestRequest) }),
    onSuccess: async () => { toast.success("Pengajuan lembur dibuat"); setDate(""); setPlannedStart(""); setPlannedEnd(""); setReason(""); await client.invalidateQueries({ queryKey: ["payroll-overtime"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const decide = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "approve" | "reject" }) => apiFetch<OvertimeRequest>(`payroll/overtime-requests/${id}/${verb}`, { method: "POST", body: JSON.stringify({ note: note || null }) }),
    onSuccess: async (_, vars) => { toast.success(vars.verb === "approve" ? "Lembur disetujui" : "Lembur ditolak"); setNote(""); await client.invalidateQueries({ queryKey: ["payroll-overtime"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (query.isLoading) return <LoadingState label="Memuat pengajuan lembur" />;
  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} retry={() => void query.refetch()} />;
  const rows = query.data?.data ?? [];

  return <div className="flex flex-col gap-4">
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader><CardTitle>Ajukan Lembur</CardTitle><CardDescription>Admin dengan payroll.manage dapat mengajukan untuk karyawan lain.</CardDescription></CardHeader>
        <CardContent><form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
          {canCreateForOthers ? <Field label="Karyawan" hint="Kosongkan untuk mengajukan atas nama akun sendiri.">{canViewEmployees && (employees.data?.data?.length ?? 0) > 0 ? <EmployeeSelect employees={employees.data?.data ?? []} value={employeeId} onChange={setEmployeeId} /> : <Input value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="ULID karyawan (opsional)" />}</Field> : null}
          <Field label="Tanggal *"><Input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Field label="Mulai terencana *"><Input required type="datetime-local" value={plannedStart} onChange={(event) => setPlannedStart(event.target.value)} /></Field>
          <Field label="Selesai terencana *"><Input required type="datetime-local" min={plannedStart || undefined} value={plannedEnd} onChange={(event) => setPlannedEnd(event.target.value)} /></Field>
          <Field label="Alasan" hint="Minimal 5 karakter bila diisi."><Input maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
          <Button type="submit" disabled={create.isPending || !date || !plannedStart || !plannedEnd}><Plus data-icon="inline-start" />Ajukan Lembur</Button>
        </form></CardContent>
      </Card>
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Pengajuan Lembur</CardTitle><CardDescription>{getPagination(query.data?.meta ?? {})?.total ?? rows.length} pengajuan ditemukan.</CardDescription></div><div className="flex flex-wrap gap-2"><Input aria-label="Dari tanggal" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /><Input aria-label="Sampai tanggal" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /><select aria-label="Filter status lembur" className="h-9 rounded-lg border bg-background px-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua status</option>{["submitted", "in_review", "approved", "rejected", "cancelled"].map((item) => <option key={item} value={item}>{item}</option>)}</select><Button variant="outline" size="sm" aria-label="Muat ulang lembur" onClick={() => void query.refetch()}><RefreshCw /></Button></div></CardHeader>
        <CardContent>
          {canApprove ? <Field label="Catatan keputusan" hint="Opsional, dipakai untuk approve/reject berikutnya."><Input maxLength={300} value={note} onChange={(event) => setNote(event.target.value)} /></Field> : null}
          {rows.length === 0 ? <div className="mt-3"><EmptyState title="Belum ada pengajuan lembur" description="Pengajuan lembur karyawan akan tampil di sini." /></div> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-4 font-medium">Karyawan</th><th className="py-3 pr-4 font-medium">Tanggal</th><th className="py-3 pr-4 font-medium">Terencana</th><th className="py-3 pr-4 font-medium">Disetujui</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 font-medium">Aksi</th></tr></thead><tbody className="divide-y">{rows.map((item) => <tr key={item.id}><td className="py-3 pr-4 font-medium">{item.employee?.full_name ?? item.employee_id}<span className="block text-xs font-normal text-muted-foreground">{item.reason ?? "Tanpa alasan"}</span></td><td className="py-3 pr-4">{formatDate(item.date)}</td><td className="py-3 pr-4 text-xs text-muted-foreground">{formatDateTime(item.planned_start)}<br />{formatDateTime(item.planned_end)}</td><td className="py-3 pr-4 text-xs text-muted-foreground">{item.approved_start ? <>{formatDateTime(item.approved_start)}<br />{formatDateTime(item.approved_end)}</> : "—"}</td><td className="py-3 pr-4"><StatusBadge status={item.status} /></td><td className="py-3"><div className="flex gap-1.5">{canApprove && ["submitted", "in_review"].includes(item.status) ? <><Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: item.id, verb: "approve" })}><CheckCircle2 data-icon="inline-start" />Setujui</Button><Button size="sm" variant="destructive" disabled={decide.isPending} onClick={() => decide.mutate({ id: item.id, verb: "reject" })}><XCircle data-icon="inline-start" />Tolak</Button></> : <span className="text-xs text-muted-foreground">Tidak ada aksi</span>}</div></td></tr>)}</tbody></table></div>}
        </CardContent>
      </Card>
    </div>
    <Card><CardHeader><CardTitle>Aturan Lembur</CardTitle><CardDescription>Aturan tenant-wide diubah pada halaman Pengaturan Payroll → Overtime Rules.</CardDescription></CardHeader><CardContent><p className="text-sm text-muted-foreground">Multiplier aturan lembur dipakai saat kalkulasi run. Perubahan aturan tidak mengubah slip yang sudah published.</p></CardContent></Card>
  </div>;
}

export function PayrollAdjustmentsView({ permissions }: { permissions: string[] }) {
  if (!hasPermission(permissions, "payroll.view")) return <UnauthorizedState />;
  return <PayrollShell permissions={permissions} current="/admin/payroll/adjustments" title="Penyesuaian & Suplisi" description="Penyesuaian gaji manual dan suplisi untuk kekurangan, koreksi, atau bonus."><AdjustmentsContent permissions={permissions} /></PayrollShell>;
}

function AdjustmentsContent({ permissions }: { permissions: string[] }) {
  return <div className="flex flex-col gap-4"><AdjustmentSection permissions={permissions} /><SupplementarySection permissions={permissions} /></div>;
}

function AdjustmentSection({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const canManage = hasPermission(permissions, "payroll.manage");
  const canApprove = hasPermission(permissions, "payroll.approve");
  const canViewEmployees = hasPermission(permissions, "employee.view");
  const [status, setStatus] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [runId, setRunId] = useState("");
  const [componentId, setComponentId] = useState("");
  const [type, setType] = useState<StoreSalaryAdjustmentRequest["type"]>("addition");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const params = new URLSearchParams({ per_page: "50", page: "1" });
  if (status) params.set("status", status);

  const employees = useEmployeeList(canViewEmployees);
  const components = useQuery({ queryKey: ["payroll-components", "adjustments"], queryFn: () => apiFetchEnvelope<SalaryComponent[]>("payroll/components?per_page=100&page=1") });
  const runs = useQuery({ queryKey: ["payroll-runs", "adjustment-filter"], queryFn: () => apiFetchEnvelope<PayrollRun[]>("payroll/runs?per_page=100&page=1") });
  const query = useQuery({ queryKey: ["payroll-adjustments", status], queryFn: () => apiFetchEnvelope<SalaryAdjustment[]>(`payroll/salary-adjustments?${params}`) });

  const create = useMutation({
    mutationFn: () => apiFetch<SalaryAdjustment>("payroll/salary-adjustments", { method: "POST", body: JSON.stringify({ employee_id: employeeId, payroll_run_id: runId || null, salary_component_id: componentId || null, type, amount: Number(amount), note } satisfies StoreSalaryAdjustmentRequest) }),
    onSuccess: async () => { toast.success("Penyesuaian gaji dibuat dan menunggu approval"); setAmount(""); setNote(""); await client.invalidateQueries({ queryKey: ["payroll-adjustments"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const approve = useMutation({
    mutationFn: (id: string) => apiFetch<SalaryAdjustment>(`payroll/salary-adjustments/${id}/approve`, { method: "POST" }),
    onSuccess: async () => { toast.success("Penyesuaian gaji disetujui"); await client.invalidateQueries({ queryKey: ["payroll-adjustments"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (query.isLoading) return <LoadingState label="Memuat penyesuaian gaji" />;
  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} retry={() => void query.refetch()} />;
  const rows = query.data?.data ?? [];

  return <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
    <Card className="h-fit"><CardHeader><CardTitle>Buat Penyesuaian</CardTitle><CardDescription>Alasan wajib (BR-PAY-19). Approval memakai permission payroll.approve.</CardDescription></CardHeader><CardContent><form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <Field label="Karyawan *">{canViewEmployees && (employees.data?.data?.length ?? 0) > 0 ? <EmployeeSelect employees={employees.data?.data ?? []} value={employeeId} onChange={setEmployeeId} required /> : <Input required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="ULID karyawan" />}</Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Jenis *"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as StoreSalaryAdjustmentRequest["type"])}><option value="addition">Addition</option><option value="deduction">Deduction</option></select></Field><Field label="Nominal *"><Input required type="number" min="0" step="1000" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field></div>
      <Field label="Payroll run" hint="Opsional; hubungkan ke run tertentu bila relevan."><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={runId} onChange={(event) => setRunId(event.target.value)}><option value="">Tidak terhubung run</option>{(runs.data?.data ?? []).map((run) => <option key={run.id} value={run.id}>{run.period?.code ?? "Run"} · {String(run.month).padStart(2, "0")}/{run.year}</option>)}</select></Field>
      <Field label="Komponen"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={componentId} onChange={(event) => setComponentId(event.target.value)}><option value="">Tanpa komponen</option>{(components.data?.data ?? []).map((component) => <option key={component.id} value={component.id}>{component.name}</option>)}</select></Field>
      <Field label="Alasan *" hint="5–300 karakter."><textarea required minLength={5} maxLength={300} className="min-h-20 rounded-lg border bg-background px-3 py-2 text-sm" value={note} onChange={(event) => setNote(event.target.value)} /></Field>
      <Button type="submit" disabled={!canManage || create.isPending || !employeeId || !amount || note.trim().length < 5}><Plus data-icon="inline-start" />Buat Penyesuaian</Button>
    </form></CardContent></Card>
    <Card><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Daftar Penyesuaian</CardTitle><CardDescription>{getPagination(query.data?.meta ?? {})?.total ?? rows.length} record.</CardDescription></div><select aria-label="Filter status penyesuaian" className="h-9 rounded-lg border bg-background px-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua status</option>{["pending", "approved", "rejected", "cancelled"].map((item) => <option key={item} value={item}>{item}</option>)}</select></CardHeader><CardContent>{rows.length === 0 ? <EmptyState title="Belum ada penyesuaian" description="Penyesuaian manual akan muncul di sini." /> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-4 font-medium">Karyawan</th><th className="py-3 pr-4 font-medium">Jenis</th><th className="py-3 pr-4 text-right font-medium">Nominal</th><th className="py-3 pr-4 font-medium">Alasan</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 font-medium">Aksi</th></tr></thead><tbody className="divide-y">{rows.map((item) => <tr key={item.id}><td className="py-3 pr-4 font-medium">{item.employee?.full_name ?? item.employee_id}</td><td className="py-3 pr-4"><Badge variant={item.type === "addition" ? "secondary" : "outline"}>{item.type}</Badge><span className="block text-xs text-muted-foreground">{item.component?.name ?? "Tanpa komponen"}</span></td><td className="py-3 pr-4 text-right font-medium">{formatRupiah(item.amount)}</td><td className="max-w-64 py-3 pr-4 text-xs text-muted-foreground">{item.note}</td><td className="py-3 pr-4"><StatusBadge status={item.status} /></td><td className="py-3">{canApprove && item.status === "pending" ? <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate(item.id)}><CheckCircle2 data-icon="inline-start" />Setujui</Button> : null}</td></tr>)}</tbody></table></div>}</CardContent></Card>
  </div>;
}

function SupplementarySection({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const canManage = hasPermission(permissions, "payroll.manage");
  const canApprove = hasPermission(permissions, "payroll.approve");
  const canViewEmployees = hasPermission(permissions, "employee.view");
  const [status, setStatus] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [type, setType] = useState<StoreSupplementaryRunRequest["type"]>("correction");
  const [amount, setAmount] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [reason, setReason] = useState("");
  const params = new URLSearchParams({ per_page: "50", page: "1" });
  if (status) params.set("status", status);
  const employees = useEmployeeList(canViewEmployees);
  const query = useQuery({ queryKey: ["payroll-supplementaries", status], queryFn: () => apiFetchEnvelope<SupplementaryRun[]>(`payroll/supplementaries?${params}`) });

  const create = useMutation({
    mutationFn: () => apiFetch<SupplementaryRun>("payroll/supplementaries", { method: "POST", body: JSON.stringify({ employee_id: employeeId, type, amount: Number(amount), period_start: periodStart, period_end: periodEnd, reason } satisfies StoreSupplementaryRunRequest) }),
    onSuccess: async () => { toast.success("Suplisi gaji dibuat"); setAmount(""); setReason(""); await client.invalidateQueries({ queryKey: ["payroll-supplementaries"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const decide = useMutation({
    mutationFn: ({ id, verb }: { id: string; verb: "approve" | "pay" }) => apiFetch<SupplementaryRun>(`payroll/supplementaries/${id}/${verb}`, { method: "POST" }),
    onSuccess: async (_, vars) => { toast.success(vars.verb === "approve" ? "Suplisi disetujui" : "Suplisi ditandai dibayar"); await client.invalidateQueries({ queryKey: ["payroll-supplementaries"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (query.isLoading) return <LoadingState label="Memuat suplisi gaji" />;
  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} retry={() => void query.refetch()} />;
  const rows = query.data?.data ?? [];

  return <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
    <Card className="h-fit"><CardHeader><CardTitle>Buat Suplisi</CardTitle><CardDescription>Kekurangan gaji, koreksi, atau bonus (PRD 07 §7.4).</CardDescription></CardHeader><CardContent><form className="flex flex-col gap-3" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <Field label="Karyawan *">{canViewEmployees && (employees.data?.data?.length ?? 0) > 0 ? <EmployeeSelect employees={employees.data?.data ?? []} value={employeeId} onChange={setEmployeeId} required /> : <Input required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="ULID karyawan" />}</Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Jenis *"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={type} onChange={(event) => setType(event.target.value as StoreSupplementaryRunRequest["type"])}><option value="shortfall">Kekurangan</option><option value="correction">Koreksi</option><option value="bonus">Bonus</option></select></Field><Field label="Nominal *"><Input required type="number" min="1" step="1000" value={amount} onChange={(event) => setAmount(event.target.value)} /></Field></div>
      <div className="grid grid-cols-2 gap-3"><Field label="Periode mulai *"><Input required type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} /></Field><Field label="Periode selesai *"><Input required type="date" min={periodStart || undefined} value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} /></Field></div>
      <Field label="Alasan *" hint="5–300 karakter."><textarea required minLength={5} maxLength={300} className="min-h-20 rounded-lg border bg-background px-3 py-2 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
      <Button type="submit" disabled={!canManage || create.isPending || !employeeId || !amount || !periodStart || !periodEnd || reason.trim().length < 5}><Plus data-icon="inline-start" />Buat Suplisi</Button>
    </form></CardContent></Card>
    <Card><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Daftar Suplisi</CardTitle><CardDescription>{getPagination(query.data?.meta ?? {})?.total ?? rows.length} record.</CardDescription></div><select aria-label="Filter status suplisi" className="h-9 rounded-lg border bg-background px-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua status</option>{["pending", "approved", "paid", "cancelled"].map((item) => <option key={item} value={item}>{item}</option>)}</select></CardHeader><CardContent>{rows.length === 0 ? <EmptyState title="Belum ada suplisi" description="Suplisi kekurangan atau bonus akan muncul di sini." /> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-4 font-medium">Karyawan</th><th className="py-3 pr-4 font-medium">Jenis</th><th className="py-3 pr-4 text-right font-medium">Nominal</th><th className="py-3 pr-4 font-medium">Periode</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 font-medium">Aksi</th></tr></thead><tbody className="divide-y">{rows.map((item) => <tr key={item.id}><td className="py-3 pr-4 font-medium">{item.employee?.full_name ?? item.employee_id}<span className="block text-xs font-normal text-muted-foreground">{item.reason}</span></td><td className="py-3 pr-4">{item.type_label ?? item.type}</td><td className="py-3 pr-4 text-right font-medium">{formatRupiah(item.amount)}</td><td className="py-3 pr-4 text-xs text-muted-foreground">{formatDate(item.period_start)} – {formatDate(item.period_end)}</td><td className="py-3 pr-4"><StatusBadge status={item.status} /></td><td className="py-3"><div className="flex gap-1.5">{canApprove && item.status === "pending" ? <Button size="sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: item.id, verb: "approve" })}>Setujui</Button> : null}{canManage && item.status === "approved" ? <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ id: item.id, verb: "pay" })}>Tandai Dibayar</Button> : null}</div></td></tr>)}</tbody></table></div>}</CardContent></Card>
  </div>;
}

export function PayrollLocksView({ permissions }: { permissions: string[] }) {
  if (!hasPermission(permissions, "payroll.view")) return <UnauthorizedState />;
  return <PayrollShell permissions={permissions} current="/admin/payroll/locks" title="Lock Payroll" description="Daftar lock periode, status, dan pembukaan lock dengan alasan wajib."><LocksContent permissions={permissions} /></PayrollShell>;
}

function LocksContent({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const canUnlock = hasPermission(permissions, "payroll.unlock");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [reason, setReason] = useState("");
  const params = new URLSearchParams({ per_page: "50", page: "1" });
  if (status) params.set("status", status);
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);
  const query = useQuery({ queryKey: ["payroll-locks", status, dateFrom, dateTo], queryFn: () => apiFetchEnvelope<PayrollLock[]>(`payroll/locks?${params}`) });
  const unlock = useMutation({
    mutationFn: (id: string) => apiFetch<PayrollLock>(`payroll/locks/${id}/unlock`, { method: "POST", body: JSON.stringify({ reason: reason.trim() }) }),
    onSuccess: async () => { toast.success("Lock payroll dibuka; presensi pada rentang terkait tidak lagi terkunci."); setReason(""); setSelectedId(""); await client.invalidateQueries({ queryKey: ["payroll-locks"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (query.isLoading) return <LoadingState label="Memuat lock payroll" />;
  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} retry={() => void query.refetch()} />;
  const rows = query.data?.data ?? [];

  return <div className="flex flex-col gap-4">
    {selectedId ? <Card><CardHeader><CardTitle>Buka Lock</CardTitle><CardDescription>Alasan wajib 5–300 karakter. Pembukaan lock juga membuka presensi terkunci pada rentang periode.</CardDescription></CardHeader><CardContent><div className="flex flex-col gap-3 sm:flex-row sm:items-end"><div className="flex-1"><Field label="Alasan unlock *"><textarea className="min-h-16 w-full rounded-lg border bg-background px-3 py-2 text-sm" maxLength={300} value={reason} onChange={(event) => setReason(event.target.value)} /></Field></div><Button variant="outline" disabled={!canUnlock || unlock.isPending || reason.trim().length < 5} onClick={() => unlock.mutate(selectedId)}><LockOpen data-icon="inline-start" />Buka Lock</Button><Button variant="ghost" onClick={() => { setSelectedId(""); setReason(""); }}>Batal</Button></div></CardContent></Card> : null}
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Riwayat Lock</CardTitle><CardDescription>{getPagination(query.data?.meta ?? {})?.total ?? rows.length} record lock.</CardDescription></div><div className="flex flex-wrap gap-2"><Input aria-label="Dari tanggal" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /><Input aria-label="Sampai tanggal" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /><select aria-label="Filter status lock" className="h-9 rounded-lg border bg-background px-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Semua status</option><option value="locked">Terkunci</option><option value="unlocked">Terbuka</option></select><Button variant="outline" size="sm" aria-label="Muat ulang lock" onClick={() => void query.refetch()}><RefreshCw /></Button></div></CardHeader>
      <CardContent>{rows.length === 0 ? <EmptyState title="Belum ada lock" description="Lock dibuat saat payroll run dikunci." /> : <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-4 font-medium">Periode</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 pr-4 font-medium">Dikunci</th><th className="py-3 pr-4 font-medium">Oleh</th><th className="py-3 pr-4 font-medium">Alasan unlock</th><th className="py-3 font-medium">Aksi</th></tr></thead><tbody className="divide-y">{rows.map((lock) => <tr key={lock.id}><td className="py-3 pr-4 font-medium">{formatDate(lock.period_start)} – {formatDate(lock.period_end)}</td><td className="py-3 pr-4"><StatusBadge status={lock.status} /></td><td className="py-3 pr-4 text-xs text-muted-foreground">{formatDateTime(lock.locked_at)}</td><td className="py-3 pr-4 text-xs text-muted-foreground">{lock.locked_by}</td><td className="max-w-64 py-3 pr-4 text-xs text-muted-foreground">{lock.unlock_reason ?? "—"}</td><td className="py-3">{lock.status === "locked" ? <Button size="sm" variant="outline" disabled={!canUnlock} onClick={() => { setSelectedId(lock.id); setReason(""); }}>Buka Lock</Button> : <span className="text-xs text-muted-foreground">Sudah terbuka</span>}</td></tr>)}</tbody></table></div>}</CardContent>
    </Card>
  </div>;
}
