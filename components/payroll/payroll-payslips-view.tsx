"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Download, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { apiFetchEnvelope, getPagination } from "@/lib/api/client";
import type { PayrollRun, Payslip } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";
import { useUrlQueryState } from "@/lib/use-url-query-state";
import { Metric, PayrollShell, StatusBadge, formatDate, formatMinutes, formatNumber, formatRupiah, useEmployeeList } from "@/components/payroll/payroll-shared";

export function PayrollPayslipsView({ permissions }: { permissions: string[] }) {
  if (!hasPermission(permissions, "payroll.view")) return <UnauthorizedState />;
  return <PayrollShell permissions={permissions} current="/admin/payroll/payslips" title="Slip Gaji" description="Daftar slip, snapshot item perhitungan, dan unduhan PDF."><PayslipsContent permissions={permissions} /></PayrollShell>;
}

function PayslipsContent({ permissions }: { permissions: string[] }) {
  const canViewEmployees = hasPermission(permissions, "employee.view");
  const { values: urlValues, update: updateUrl } = useUrlQueryState();
  const status = urlValues.get("status") ?? "";
  const runId = urlValues.get("run_id") ?? "";
  const employeeId = urlValues.get("employee_id") ?? "";
  const [selectedId, setSelectedId] = useState("");
  const page = Math.max(1, Number(urlValues.get("page") ?? "1") || 1);
  const params = new URLSearchParams({ per_page: "50", page: String(page) });
  if (status) params.set("status", status);
  if (runId) params.set("payroll_run_id", runId);
  if (employeeId) params.set("employee_id", employeeId);

  const runs = useQuery({ queryKey: ["payroll-runs", "payslip-filter"], queryFn: () => apiFetchEnvelope<PayrollRun[]>("payroll/runs?per_page=100&page=1") });
  const employees = useEmployeeList(canViewEmployees);
  const slips = useQuery({ queryKey: ["payslips", "list", status, runId, employeeId, page], queryFn: () => apiFetchEnvelope<Payslip[]>(`payroll/payslips?${params}`) });

  if (slips.isLoading) return <LoadingState label="Memuat slip gaji" />;
  if (slips.isError) return <ErrorState message={getErrorMessage(slips.error)} retry={() => void slips.refetch()} />;
  const rows = slips.data?.data ?? [];
  const pagination = getPagination(slips.data?.meta ?? {});

  return <div className="flex flex-col gap-4">
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div><CardTitle>Daftar Slip Gaji</CardTitle><CardDescription>{getPagination(slips.data?.meta ?? {})?.total ?? rows.length} slip ditemukan. Slip published adalah snapshot yang tidak dapat diubah.</CardDescription></div>
        <div className="flex flex-wrap items-start gap-2">
          <select aria-label="Filter status slip" className="h-9 rounded-lg border bg-background px-2 text-sm" value={status} onChange={(event) => updateUrl({ status: event.target.value, page: "1" })}><option value="">Semua status</option>{["draft", "calculated", "reviewed", "locked", "published", "cancelled"].map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <select aria-label="Filter payroll run" className="h-9 max-w-56 rounded-lg border bg-background px-2 text-sm" value={runId} onChange={(event) => updateUrl({ run_id: event.target.value, page: "1" })}><option value="">Semua run</option>{(runs.data?.data ?? []).map((run) => <option key={run.id} value={run.id}>{run.period?.code ?? "Run"} · {String(run.month).padStart(2, "0")}/{run.year}{run.term ? ` · T${run.term}` : ""}</option>)}</select>
          {canViewEmployees && (employees.data?.data?.length ?? 0) > 0 ? <select aria-label="Filter karyawan" className="h-9 max-w-56 rounded-lg border bg-background px-2 text-sm" value={employeeId} onChange={(event) => updateUrl({ employee_id: event.target.value, page: "1" })}><option value="">Semua karyawan</option>{(employees.data?.data ?? []).map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_number}</option>)}</select> : <Input aria-label="Employee ID" className="w-52" placeholder="Employee ULID" value={employeeId} onChange={(event) => updateUrl({ employee_id: event.target.value, page: "1" })} />}
          <Button variant="outline" size="sm" aria-label="Muat ulang slip" onClick={() => void slips.refetch()}><RefreshCw /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? <EmptyState title="Belum ada slip gaji" description="Slip dibuat setelah payroll run dikalkulasi." /> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-4 font-medium">Slip</th><th className="py-3 pr-4 font-medium">Karyawan</th><th className="py-3 pr-4 font-medium">Periode</th><th className="py-3 pr-4 text-right font-medium">THP</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 font-medium">Aksi</th></tr></thead><tbody className="divide-y">{rows.map((slip) => <tr key={slip.id} className={selectedId === slip.id ? "bg-accent/50" : undefined}><td className="py-3 pr-4"><p className="font-medium">{slip.slip_number}</p><p className="text-xs text-muted-foreground">Gross {formatRupiah(slip.gross_amount)}</p></td><td className="py-3 pr-4">{slip.employee?.full_name ?? slip.employee_id}<span className="block text-xs text-muted-foreground">{slip.employee?.employee_number}</span></td><td className="py-3 pr-4 text-muted-foreground">{formatDate(slip.period_start)} – {formatDate(slip.period_end)}</td><td className="py-3 pr-4 text-right font-medium">{formatRupiah(slip.net_amount)}</td><td className="py-3 pr-4"><StatusBadge status={slip.status} /></td><td className="py-3"><div className="flex gap-1.5"><Button size="sm" variant="outline" onClick={() => setSelectedId(slip.id === selectedId ? "" : slip.id)}>{slip.id === selectedId ? "Tutup" : "Detail"}</Button><Button asChild size="sm" variant="ghost"><Link href={`/api/proxy/payroll/payslips/${slip.id}/pdf`} target="_blank" rel="noreferrer" aria-label={`Buka PDF ${slip.slip_number}`}><Download /></Link></Button></div></td></tr>)}</tbody></table></div>}
      </CardContent>
    </Card>
    {pagination && pagination.last_page > 1 ? <div className="flex items-center justify-between gap-3 text-sm"><p className="text-muted-foreground">Menampilkan {pagination.from ?? 0}–{pagination.to ?? 0} dari {pagination.total}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.current_page <= 1} onClick={() => updateUrl({ page: String(Math.max(1, page - 1)) })}><ChevronLeft data-icon="inline-start" />Sebelumnya</Button><Button variant="outline" size="sm" disabled={pagination.current_page >= pagination.last_page} onClick={() => updateUrl({ page: String(Math.min(pagination.last_page, page + 1)) })}>Berikutnya<ChevronRight data-icon="inline-end" /></Button></div></div> : null}
    {selectedId ? <PayslipDetail payslipId={selectedId} onClose={() => setSelectedId("")} /> : null}
  </div>;
}

function PayslipDetail({ payslipId, onClose }: { payslipId: string; onClose: () => void }) {
  const query = useQuery({ queryKey: ["payslip", payslipId], queryFn: () => apiFetchEnvelope<Payslip>(`payroll/payslips/${payslipId}`) });
  if (query.isLoading) return <LoadingState label="Memuat detail slip" />;
  if (query.isError || !query.data?.data) return <ErrorState message={getErrorMessage(query.error)} retry={() => void query.refetch()} />;
  const slip = query.data.data;
  const items = slip.items ?? [];
  return <Card>
    <CardHeader className="flex-row items-start justify-between gap-3">
      <div><CardTitle>{slip.slip_number}</CardTitle><CardDescription>{slip.employee?.full_name ?? slip.employee_id} · {formatDate(slip.period_start)} – {formatDate(slip.period_end)} · {slip.wage_type}</CardDescription></div>
      <div className="flex shrink-0 gap-2"><Button asChild size="sm"><Link href={`/api/proxy/payroll/payslips/${slip.id}/pdf`} target="_blank" rel="noreferrer"><FileText data-icon="inline-start" />Unduh PDF</Link></Button><Button variant="ghost" size="sm" onClick={onClose}>Tutup</Button></div>
    </CardHeader>
    <CardContent className="flex flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid grid-cols-2 gap-3 rounded-xl border p-4 text-sm sm:grid-cols-3">
          <Detail label="Status" value={<StatusBadge status={slip.status} />} />
          <Detail label="Hari kerja" value={formatNumber(slip.working_days, 0)} />
          <Detail label="Hadir" value={formatNumber(slip.attendance_days, 0)} />
          <Detail label="Alpa" value={formatNumber(slip.absent_days, 0)} />
          <Detail label="Cuti dibayar" value={formatNumber(slip.paid_leave_days, 0)} />
          <Detail label="Cuti tidak dibayar" value={formatNumber(slip.unpaid_leave_days, 0)} />
          <Detail label="Terlambat" value={formatMinutes(slip.late_minutes)} />
          <Detail label="Lembur" value={formatMinutes(slip.overtime_minutes)} />
          <Detail label="Carry forward" value={formatRupiah(slip.carry_forward_amount)} />
        </div>
        <div className="rounded-xl border p-4">
          <Metric label="Gaji pokok penuh" value={formatRupiah(slip.basic_salary_full)} />
          <Metric label="Gaji pokok prorata" value={formatRupiah(slip.basic_salary)} />
          <Metric label="Gross" value={formatRupiah(slip.gross_amount)} />
          <Metric label="Potongan" value={formatRupiah(slip.deduction_amount)} />
          <Metric label="Pajak" value={formatRupiah(slip.tax_amount)} />
          <Metric label="Kontribusi perusahaan" value={formatRupiah(slip.employer_contribution)} />
          <Metric label="Take home pay" value={formatRupiah(slip.net_amount)} />
        </div>
      </div>
      <div className="rounded-xl border p-4">
        <h3 className="font-semibold">Snapshot Items</h3>
        <p className="text-xs text-muted-foreground">Item berasal dari kalkulasi API. Status published bersifat final.</p>
        {items.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">Slip ini belum memiliki item perhitungan.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 pr-4 font-medium">Komponen</th><th className="py-2 pr-4 font-medium">Kategori</th><th className="py-2 pr-4 text-right font-medium">Qty</th><th className="py-2 pr-4 text-right font-medium">Rate</th><th className="py-2 text-right font-medium">Amount</th></tr></thead><tbody className="divide-y">{items.map((item) => <tr key={item.id}><td className="py-2 pr-4 font-medium">{item.name}<span className="block text-xs font-normal text-muted-foreground">{item.code}</span></td><td className="py-2 pr-4 text-muted-foreground">{item.category}</td><td className="py-2 pr-4 text-right">{item.quantity === null || item.quantity === undefined ? "—" : formatNumber(item.quantity, 2)}</td><td className="py-2 pr-4 text-right">{item.rate === null || item.rate === undefined ? "—" : formatRupiah(item.rate)}</td><td className="py-2 text-right font-medium">{formatRupiah(item.amount)}</td></tr>)}</tbody></table></div>}
      </div>
      {slip.notes ? <div className="rounded-xl border bg-muted/30 p-4 text-sm"><strong>Catatan:</strong> {slip.notes}</div> : null}
    </CardContent>
  </Card>;
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><div className="mt-1 font-medium">{value}</div></div>;
}
