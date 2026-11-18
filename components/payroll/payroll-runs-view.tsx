"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Download, Lock, LockOpen, Play, Plus, RefreshCw, Send, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { ApiError, apiFetch, apiFetchEnvelope, getPagination } from "@/lib/api/client";
import type { PayrollPeriod, PayrollRun, PayrollRunExport, PayrollRunReconciliation, PayrollRunSummary, Payslip, StorePayrollRunRequest } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";
import { useUrlQueryState } from "@/lib/use-url-query-state";
import { Field, Metric, PayrollShell, StatusBadge, formatCompactRupiah, formatDate, formatMonth, formatRupiah, statusLabel, useEmployeeList } from "@/components/payroll/payroll-shared";

const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

const payrollRunBaseSchema = z.object({
  payroll_period_id: z.string().min(1, "Pilih periode payroll."),
  year: z.coerce.number().int().min(2000, "Tahun minimal 2000.").max(2100, "Tahun maksimal 2100."),
  month: z.coerce.number().int().min(1, "Pilih bulan.").max(12, "Pilih bulan."),
  term: z.string(),
  notes: z.string().max(1000, "Catatan maksimal 1.000 karakter."),
  semi_monthly: z.boolean(),
});

const payrollRunSchema = payrollRunBaseSchema.superRefine((values, context) => {
  if (values.semi_monthly && values.term !== "1" && values.term !== "2") {
    context.addIssue({ code: "custom", path: ["term"], message: "Periode semi-monthly membutuhkan termin 1 atau 2." });
  }
});

type PayrollRunForm = z.infer<typeof payrollRunSchema>;

export function PayrollRunsView({ permissions }: { permissions: string[] }) {
  if (!hasPermission(permissions, "payroll.view")) return <UnauthorizedState />;
  return <PayrollShell permissions={permissions} current="/admin/payroll" title="Payroll Run" description="Buat run, kalkulasi, review, kunci, publikasikan, dan rekonsiliasi payroll."><PayrollRunsContent permissions={permissions} /></PayrollShell>;
}

function PayrollRunsContent({ permissions }: { permissions: string[] }) {
  const client = useQueryClient();
  const canManage = hasPermission(permissions, "payroll.manage");
  const now = new Date();
  const form = useForm<PayrollRunForm>({
    resolver: zodResolver(payrollRunSchema),
    defaultValues: { payroll_period_id: "", year: now.getFullYear(), month: now.getMonth() + 1, term: "", notes: "", semi_monthly: false },
  });
  const periodId = form.watch("payroll_period_id");
  const { values: urlValues, update: updateUrl } = useUrlQueryState();
  const status = urlValues.get("status") ?? "";
  const page = Math.max(1, Number(urlValues.get("page") ?? "1") || 1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const periods = useQuery({ queryKey: ["payroll-periods", "active"], queryFn: () => apiFetchEnvelope<PayrollPeriod[]>("payroll/periods?active=true&per_page=100") });
  const runsParams = new URLSearchParams({ per_page: "50", page: String(page) });
  if (status) runsParams.set("status", status);
  const runs = useQuery({
    queryKey: ["payroll-runs", "list", status, page],
    queryFn: () => apiFetchEnvelope<PayrollRun[]>(`payroll/runs?${runsParams}`),
    refetchInterval: (query) => {
      const rows = query.state.data?.data ?? [];
      return rows.some((run) => run.status === "calculating") ? 4000 : false;
    },
  });
  const selectedPeriod = periods.data?.data?.find((item) => item.id === periodId);

  const create = useMutation({
    mutationFn: (payload: StorePayrollRunRequest) => apiFetch<PayrollRun>("payroll/runs", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: async (run) => {
      toast.success("Payroll run dibuat. Jalankan kalkulasi untuk menghitung slip.");
      form.setValue("notes", "");
      setSelectedId(run.id);
      await client.invalidateQueries({ queryKey: ["payroll-runs"] });
    },
    onError: (error) => {
      const errors = error instanceof ApiError ? error.fieldErrors ?? {} : {};
      for (const [key, messages] of Object.entries(errors)) {
        if (key in payrollRunBaseSchema.shape) form.setError(key as keyof PayrollRunForm, { type: "server", message: messages[0] ?? "Periksa nilai ini." });
      }
      toast.error(Object.values(errors).flat()[0] ?? getErrorMessage(error));
    },
  });

  function submit(values: PayrollRunForm) {
    create.mutate({ payroll_period_id: values.payroll_period_id, year: values.year, month: values.month, term: selectedPeriod?.is_semi_monthly && values.term ? Number(values.term) : null, notes: values.notes || null });
  }

  if (periods.isLoading || runs.isLoading) return <LoadingState label="Memuat payroll run" />;
  if (periods.isError) return <ErrorState message={getErrorMessage(periods.error)} retry={() => void periods.refetch()} />;
  if (runs.isError) return <ErrorState message={getErrorMessage(runs.error)} retry={() => void runs.refetch()} />;

  const rows = runs.data?.data ?? [];
  const latest = rows[0];
  const needsReview = rows.filter((run) => ["calculated", "reviewed"].includes(run.status)).length;
  const published = rows.filter((run) => run.status === "published").length;

  return <div className="flex flex-col gap-4">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard label="Payroll bulan terakhir" value={latest ? formatCompactRupiah(latest.total_net) : "—"} hint={latest ? `${formatMonth(latest.year, latest.month)} · ${statusLabel(latest.status)}` : "Belum ada payroll run"} />
      <StatCard label="Karyawan pada run terakhir" value={latest ? String(latest.employee_count) : "—"} hint="Jumlah slip yang dihitung API" />
      <StatCard label="Perlu review" value={String(needsReview)} hint="Status terhitung atau direview" tone="amber" />
      <StatCard label="Terpublikasi" value={String(published)} hint={`Dari ${rows.length} run pada halaman ini`} tone="emerald" />
    </div>

    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <Card className="h-fit">
        <CardHeader><CardTitle>Buat Payroll Run</CardTitle><CardDescription>Run baru dibuat sebagai draft; kalkulasi dijalankan sebagai proses antrean.</CardDescription></CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(submit)}>
            <Field label="Periode Payroll *" error={form.formState.errors.payroll_period_id?.message} htmlFor="payroll-period">
              <select id="payroll-period" aria-invalid={Boolean(form.formState.errors.payroll_period_id)} aria-describedby={form.formState.errors.payroll_period_id ? "payroll-period-error" : undefined} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" {...form.register("payroll_period_id")} onChange={(event) => { const nextId = event.target.value; const nextPeriod = periods.data?.data?.find((item) => item.id === nextId); form.setValue("payroll_period_id", nextId, { shouldValidate: true }); form.setValue("semi_monthly", Boolean(nextPeriod?.is_semi_monthly)); if (!nextPeriod?.is_semi_monthly) form.setValue("term", ""); }}>
                <option value="">Pilih periode</option>
                {(periods.data?.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tahun *" error={form.formState.errors.year?.message}><Input type="number" min="2000" max="2100" aria-invalid={Boolean(form.formState.errors.year)} aria-describedby={form.formState.errors.year ? "run-year-error" : undefined} {...form.register("year")} /></Field>
              <Field label="Bulan *" error={form.formState.errors.month?.message}><select aria-invalid={Boolean(form.formState.errors.month)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm" {...form.register("month", { valueAsNumber: true })}><option value="">Pilih bulan</option>{monthNames.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select></Field>
            </div>
            <Field label="Termin" error={form.formState.errors.term?.message} hint={selectedPeriod?.is_semi_monthly ? "Periode semi-monthly mewajibkan termin 1 atau 2." : "Periode bulanan tidak memakai termin."}>
              <select disabled={!selectedPeriod?.is_semi_monthly} aria-invalid={Boolean(form.formState.errors.term)} className="h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:cursor-not-allowed disabled:opacity-60" {...form.register("term")}>
                <option value="">Tidak ada</option>
                <option value="1">Termin 1</option>
                <option value="2">Termin 2</option>
              </select>
            </Field>
            <Field label="Catatan" error={form.formState.errors.notes?.message} hint="Maksimal 1.000 karakter."><textarea className="min-h-20 rounded-lg border bg-background px-3 py-2 text-sm" maxLength={1000} {...form.register("notes")} placeholder="Payroll reguler bulan ini" /></Field>
            {canManage ? <Button type="submit" disabled={create.isPending}><Plus data-icon="inline-start" />{create.isPending ? "Menyimpan..." : "Buat Payroll Run"}</Button> : <p className="text-sm text-muted-foreground">Permission <code className="rounded bg-muted px-1">payroll.manage</code> diperlukan untuk membuat run.</p>}
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-xs leading-5 text-blue-900"><p className="font-medium">Lifecycle run</p><p>draft → calculating → calculated → reviewed → locked → published.</p><p className="mt-1">Unlock wajib dengan alasan 5–300 karakter. Publish membuat slip menjadi snapshot permanen.</p></div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-start justify-between gap-3">
          <div><CardTitle>Payroll Runs</CardTitle><CardDescription>{getPagination(runs.data?.meta ?? {})?.total ?? rows.length} run ditemukan. Pilih run untuk melihat ringkasan dan tindakan.</CardDescription></div>
          <div className="flex shrink-0 items-center gap-2">
            <label className="sr-only" htmlFor="run-status">Filter status</label>
            <select id="run-status" className="h-9 rounded-lg border bg-background px-2 text-sm" value={status} onChange={(event) => updateUrl({ status: event.target.value, page: "1" })}><option value="">Semua status</option>{["draft", "calculating", "calculated", "reviewed", "locked", "published", "cancelled"].map((item) => <option key={item} value={item}>{statusLabel(item)}</option>)}</select>
            <Button variant="outline" size="sm" aria-label="Muat ulang payroll run" onClick={() => void runs.refetch()}><RefreshCw /></Button>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? <EmptyState title="Belum ada payroll run" description="Buat run pertama untuk periode dan bulan yang tersedia." /> : <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-4 font-medium">Run / Periode</th><th className="py-3 pr-4 font-medium">Rentang</th><th className="py-3 pr-4 text-right font-medium">Total THP</th><th className="py-3 pr-4 text-right font-medium">Karyawan</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 font-medium">Aksi</th></tr></thead><tbody className="divide-y">{rows.map((run) => <tr key={run.id} className={selectedId === run.id ? "bg-accent/50" : undefined}><td className="py-3 pr-4"><p className="font-medium">{run.period?.code ?? "Periode"} · {String(run.month).padStart(2, "0")}/{run.year}</p><p className="text-xs text-muted-foreground">versi {run.version}{run.term ? ` · termin ${run.term}` : ""}</p></td><td className="py-3 pr-4 text-muted-foreground">{formatDate(run.period_start)} – {formatDate(run.period_end)}</td><td className="py-3 pr-4 text-right font-medium">{formatCompactRupiah(run.total_net)}</td><td className="py-3 pr-4 text-right">{run.employee_count}</td><td className="py-3 pr-4"><StatusBadge status={run.status} /></td><td className="py-3"><Button size="sm" variant="outline" onClick={() => setSelectedId(run.id === selectedId ? null : run.id)}>{run.id === selectedId ? "Tutup" : "Detail"}</Button></td></tr>)}</tbody></table></div>}
          {(getPagination(runs.data?.meta ?? {})?.last_page ?? 1) > 1 ? <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4 text-sm"><span>Halaman {page} dari {getPagination(runs.data?.meta ?? {})?.last_page}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => updateUrl({ page: String(page - 1) })}>Sebelumnya</Button><Button size="sm" variant="outline" disabled={page >= (getPagination(runs.data?.meta ?? {})?.last_page ?? page)} onClick={() => updateUrl({ page: String(page + 1) })}>Berikutnya</Button></div></div> : null}
        </CardContent>
      </Card>
    </div>

    {selectedId ? <PayrollRunDetail runId={selectedId} permissions={permissions} onClose={() => setSelectedId(null)} /> : null}
  </div>;
}

function StatCard({ label, value, hint, tone = "blue" }: { label: string; value: string; hint: string; tone?: "blue" | "amber" | "emerald" }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "amber" ? "text-amber-700" : "text-primary";
  return <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{hint}</p></CardContent></Card>;
}

function PayrollRunDetail({ runId, permissions, onClose }: { runId: string; permissions: string[]; onClose: () => void }) {
  const client = useQueryClient();
  const [unlockReason, setUnlockReason] = useState("");
  const can = (permission: string) => hasPermission(permissions, permission);
  const run = useQuery({ queryKey: ["payroll-run", runId], queryFn: () => apiFetchEnvelope<PayrollRun>(`payroll/runs/${runId}`), refetchInterval: (query) => query.state.data?.data?.status === "calculating" ? 4000 : false });
  const runStatus = run.data?.data?.status ?? "none";
  const summary = useQuery({ queryKey: ["payroll-run", runId, "summary", runStatus], queryFn: () => apiFetchEnvelope<PayrollRunSummary>(`payroll/runs/${runId}/summary`), enabled: runStatus !== "none" && runStatus !== "calculating" });
  const reconciliation = useQuery({ queryKey: ["payroll-run", runId, "reconciliation", runStatus], queryFn: () => apiFetchEnvelope<PayrollRunReconciliation>(`payroll/runs/${runId}/reconciliation`), enabled: runStatus !== "none" && runStatus !== "calculating" });
  const payslips = useQuery({ queryKey: ["payslips", "run", runId, runStatus], queryFn: () => apiFetchEnvelope<Payslip[]>(`payroll/payslips?payroll_run_id=${runId}&per_page=100`), enabled: runStatus !== "none" && runStatus !== "calculating" });
  const employees = useEmployeeList(can("employee.view") && can("payroll.manage"));

  const action = useMutation({
    mutationFn: ({ verb, body }: { verb: string; body?: Record<string, unknown> }) => apiFetch<PayrollRun>(`payroll/runs/${runId}/${verb}`, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
    onSuccess: async (updated, vars) => {
      toast.success(actionMessage(vars.verb));
      setUnlockReason("");
      await client.invalidateQueries({ queryKey: ["payroll-run", runId] });
      await client.invalidateQueries({ queryKey: ["payroll-runs"] });
      await client.invalidateQueries({ queryKey: ["payslips"] });
      await client.invalidateQueries({ queryKey: ["payroll-locks"] });
      if (updated.status !== "calculating") await client.invalidateQueries({ queryKey: ["payroll-run", runId, "summary"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  const exportRun = useMutation({
    mutationFn: () => apiFetch<PayrollRunExport>(`payroll/runs/${runId}/export`),
    onSuccess: (payload) => downloadCsv(payload),
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (run.isLoading) return <LoadingState label="Memuat detail payroll run" />;
  if (run.isError || !run.data?.data) return <ErrorState message={getErrorMessage(run.error)} retry={() => void run.refetch()} />;

  const data = run.data.data;
  const canCancel = can("payroll.manage") && !["published", "cancelled"].includes(data.status);
  const slips = payslips.data?.data ?? [];
  const recon = reconciliation.data?.data;

  return <Card>
    <CardHeader className="flex-row items-start justify-between gap-3">
      <div><CardTitle>Run {data.period?.code ?? ""} · {formatMonth(data.year, data.month)}{data.term ? ` · Termin ${data.term}` : ""}</CardTitle><CardDescription>{formatDate(data.period_start)} – {formatDate(data.period_end)} · versi {data.version} · status {statusLabel(data.status)}</CardDescription></div>
      <div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => void run.refetch()}><RefreshCw data-icon="inline-start" />Muat ulang</Button><Button variant="ghost" size="sm" onClick={onClose}>Tutup</Button></div>
    </CardHeader>
    <CardContent className="flex flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-xl border p-4">
          <h3 className="font-semibold">Tindakan Lifecycle</h3>
          <p className="mt-1 text-xs text-muted-foreground">Hanya transisi yang valid untuk status saat ini yang ditampilkan.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {data.status === "draft" && can("payroll.manage") ? <Button size="sm" disabled={action.isPending} onClick={() => action.mutate({ verb: "calculate" })}><Play data-icon="inline-start" />Kalkulasi</Button> : null}
            {["calculated", "reviewed"].includes(data.status) && can("payroll.manage") ? <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ verb: "recalculate" })}><RefreshCw data-icon="inline-start" />Kalkulasi ulang</Button> : null}
            {data.status === "calculated" && can("payroll.manage") ? <Button size="sm" disabled={action.isPending} onClick={() => action.mutate({ verb: "review" })}><CheckCircle2 data-icon="inline-start" />Tandai reviewed</Button> : null}
            {data.status === "reviewed" && can("payroll.lock") ? <Button size="sm" disabled={action.isPending} onClick={() => { if (window.confirm("Kunci payroll run ini? Presensi pada rentang periode akan ikut terkunci sampai dibuka.")) action.mutate({ verb: "lock" }); }}><Lock data-icon="inline-start" />Kunci</Button> : null}
            {data.status === "locked" && can("payroll.publish") ? <Button size="sm" disabled={action.isPending} onClick={() => { if (window.confirm("Publikasikan payroll run ini? Slip menjadi snapshot permanen dan tidak dapat diubah.")) action.mutate({ verb: "publish" }); }}><Send data-icon="inline-start" />Publikasikan</Button> : null}
            {canCancel ? <Button size="sm" variant="destructive" disabled={action.isPending} onClick={() => { if (window.confirm("Batalkan payroll run ini? Slip akan berstatus dibatalkan.")) action.mutate({ verb: "cancel" }); }}><XCircle data-icon="inline-start" />Batalkan</Button> : null}
            <Button size="sm" variant="outline" disabled={exportRun.isPending} onClick={() => exportRun.mutate()}><Download data-icon="inline-start" />{exportRun.isPending ? "Menyiapkan..." : "Export CSV"}</Button>
          </div>
          {data.status === "locked" && can("payroll.unlock") ? <div className="mt-4 border-t pt-4"><Field label="Alasan unlock *" hint="Wajib 5–300 karakter (BR-PAY-06)."><textarea className="min-h-16 rounded-lg border bg-background px-3 py-2 text-sm" maxLength={300} value={unlockReason} onChange={(event) => setUnlockReason(event.target.value)} /></Field><Button className="mt-2" size="sm" variant="outline" disabled={action.isPending || unlockReason.trim().length < 5 || unlockReason.trim().length > 300} onClick={() => action.mutate({ verb: "unlock", body: { reason: unlockReason.trim() } })}><LockOpen data-icon="inline-start" />Buka kunci</Button></div> : null}
          <p className="mt-3 text-[11px] text-muted-foreground">Lock membutuhkan rekonsiliasi total run = jumlah slip. Publish membuat PDF slip dan snapshot tidak dapat diubah.</p>
        </div>
        <div className="rounded-xl border p-4">
          <h3 className="font-semibold">Ringkasan</h3>
          <div className="mt-2"><Metric label="Gross" value={formatRupiah(data.total_gross)} /><Metric label="Potongan" value={formatRupiah(data.total_deduction)} /><Metric label="Pajak" value={formatRupiah(data.total_tax)} /><Metric label="Take home pay" value={formatRupiah(data.total_net)} /><Metric label="Karyawan" value={`${data.employee_count} slip`} /></div>
          {summary.data?.data ? <div className="mt-3 flex flex-wrap gap-2">{(Object.entries(summary.data.data.slips_by_status) as Array<[string, number]>).map(([key, value]) => <Badge key={key} variant="outline">{statusLabel(key)}: {value}</Badge>)}</div> : null}
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-semibold">Rekonsiliasi</h3><p className="text-xs text-muted-foreground">Total run dibandingkan jumlah slip aktif (BR-PAY-21).</p></div>{recon ? <Badge className={recon.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}>{recon.ok ? "OK" : "Tidak seimbang"}</Badge> : null}</div>
        {reconciliation.isError ? <p className="mt-2 text-sm text-destructive">{getErrorMessage(reconciliation.error)}</p> : recon ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 pr-4 font-medium">Komponen</th><th className="py-2 pr-4 text-right font-medium">Run</th><th className="py-2 pr-4 text-right font-medium">Jumlah slip</th><th className="py-2 text-right font-medium">Selisih</th></tr></thead><tbody className="divide-y">{(["gross", "deduction", "tax", "net", "employee_count"] as const).map((key) => { const row = recon[key]; const diff = row.run - row.slips; return <tr key={key}><td className="py-2 pr-4 capitalize">{key === "employee_count" ? "Karyawan" : key}</td><td className="py-2 pr-4 text-right">{key === "employee_count" ? row.run : formatRupiah(row.run)}</td><td className="py-2 pr-4 text-right">{key === "employee_count" ? row.slips : formatRupiah(row.slips)}</td><td className={`py-2 text-right font-medium ${diff === 0 ? "text-emerald-700" : "text-red-700"}`}>{key === "employee_count" ? diff : formatRupiah(diff)}</td></tr>; })}</tbody></table></div> : <p className="mt-2 text-sm text-muted-foreground">{runStatus === "calculating" ? "Kalkulasi sedang berjalan; rekonsiliasi tersedia setelah selesai." : "Memuat rekonsiliasi…"}</p>}
      </div>

      <div className="rounded-xl border p-4">
        <h3 className="font-semibold">Slip Gaji pada Run Ini</h3>
        {payslips.isError ? <p className="mt-2 text-sm text-destructive">{getErrorMessage(payslips.error)}</p> : slips.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Belum ada slip. Jalankan kalkulasi setelah assignment periode dan komponen gaji tersedia.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 pr-4 font-medium">Slip</th><th className="py-2 pr-4 font-medium">Karyawan</th><th className="py-2 pr-4 text-right font-medium">THP</th><th className="py-2 font-medium">Status</th></tr></thead><tbody className="divide-y">{slips.map((slip) => <tr key={slip.id}><td className="py-2 pr-4 font-medium">{slip.slip_number}</td><td className="py-2 pr-4">{slip.employee?.full_name ?? slip.employee_id}</td><td className="py-2 pr-4 text-right">{formatRupiah(slip.net_amount)}</td><td className="py-2"><StatusBadge status={slip.status} /></td></tr>)}</tbody></table></div>}
      </div>

      {can("payroll.manage") && employees.data ? <p className="text-xs text-muted-foreground">Total {employees.data.data?.length ?? 0} karyawan aktif tersedia untuk kebutuhan assignment.</p> : null}
    </CardContent>
  </Card>;
}

function actionMessage(verb: string) {
  switch (verb) {
    case "calculate": return "Kalkulasi payroll sedang berjalan";
    case "recalculate": return "Kalkulasi ulang payroll sedang berjalan";
    case "review": return "Payroll run ditandai reviewed";
    case "lock": return "Payroll run terkunci";
    case "unlock": return "Kunci payroll run dibuka";
    case "publish": return "Payroll run dipublikasikan";
    case "cancel": return "Payroll run dibatalkan";
    default: return "Tindakan payroll berhasil";
  }
}

function downloadCsv(payload: PayrollRunExport) {
  const escape = (cell: unknown) => `"${String(cell ?? "").replaceAll('"', '""')}"`;
  const rows = [payload.header, ...payload.rows].map((row) => row.map(escape).join(payload.delimiter)).join("\r\n");
  const blob = new Blob([`\ufeff${rows}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `payroll-run-${payload.run.year}-${String(payload.run.month).padStart(2, "0")}${payload.run.term ? `-term-${payload.run.term}` : ""}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
