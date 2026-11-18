"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, LockKeyhole, MoreHorizontal, Plus, RefreshCw, Search, Trash2, UnlockKeyhole, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Phase2Navigation } from "@/components/phase2-navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { apiFetch, apiFetchEnvelope, getPagination } from "@/lib/api/client";
import type { AttendanceCorrection, AttendanceRecord, AttendanceSummaryData, Branch, Employee } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";

const statusLabels: Record<string, string> = {
  present: "Hadir", late: "Terlambat", on_leave: "Izin / Cuti", absent: "Alpha", sick: "Sakit",
  permit: "Izin", business_trip: "Dinas", holiday: "Libur", off: "Libur", incomplete: "Belum lengkap",
};

const statusTone: Record<string, string> = {
  present: "bg-emerald-50 text-emerald-700", late: "bg-amber-50 text-amber-700", on_leave: "bg-violet-50 text-violet-700",
  absent: "bg-red-50 text-red-700", sick: "bg-sky-50 text-sky-700", permit: "bg-sky-50 text-sky-700",
  business_trip: "bg-blue-50 text-blue-700", incomplete: "bg-slate-100 text-slate-600", holiday: "bg-slate-100 text-slate-600", off: "bg-slate-100 text-slate-600",
};

export function AdminAttendanceView({ permissions, timezone = "UTC" }: { permissions: string[]; timezone?: string }) {
  const canView = hasPermission(permissions, "attendance.view");
  const canCorrect = hasPermission(permissions, "attendance.correct");
  const canLock = hasPermission(permissions, "attendance.lock");
  const queryClient = useQueryClient();
  const [date, setDate] = useState(today());
  const [status, setStatus] = useState("");
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const params = new URLSearchParams({ date_from: date, date_to: date, per_page: "100", page: "1" });
  if (status) params.set("status", status);
  if (branchId) params.set("branch_id", branchId);

  const attendance = useQuery({
    queryKey: ["attendance", "admin", date, status, branchId],
    queryFn: () => apiFetchEnvelope<AttendanceRecord[]>(`attendance?${params.toString()}`),
    enabled: canView,
  });
  const summary = useQuery({
    queryKey: ["attendance-summary", date],
    queryFn: () => apiFetch<AttendanceSummaryData>(`attendance/summary?date=${date}`),
    enabled: canView,
  });
  const corrections = useQuery({
    queryKey: ["attendance-corrections", "submitted"],
    queryFn: () => apiFetchEnvelope<AttendanceCorrection[]>("attendance/corrections?status=submitted&per_page=20&page=1"),
    enabled: canView,
  });
  const branches = useQuery({
    queryKey: ["organization", "branches"],
    queryFn: () => apiFetchEnvelope<Branch[]>("organization/branches?per_page=100"),
    enabled: canView,
  });
  const employees = useQuery({
    queryKey: ["employees", "attendance-select"],
    queryFn: () => apiFetchEnvelope<Employee[]>("employees?per_page=100&is_active=true"),
    enabled: manualOpen && canCorrect,
  });

  const filteredRows = useMemo(() => (attendance.data?.data ?? []).filter((row) => employeeName(row).toLocaleLowerCase("id-ID").includes(search.trim().toLocaleLowerCase("id-ID"))), [attendance.data, search]);
  const pendingCorrections = corrections.data?.data ?? [];
  const review = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: "approve" | "reject" }) => apiFetch<AttendanceCorrection>(`attendance/corrections/${id}/${decision}`, { method: "POST" }),
    onSuccess: async (_, variables) => {
      toast.success(variables.decision === "approve" ? "Koreksi disetujui" : "Koreksi ditolak");
      await queryClient.invalidateQueries({ queryKey: ["attendance-corrections"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const recordAction = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "recalculate" | "lock" | "unlock" | "delete" }) => apiFetch<null>(`attendance/${id}${action === "delete" ? "" : `/${action}`}`, { method: action === "delete" ? "DELETE" : "POST" }),
    onSuccess: async (_, variables) => {
      toast.success(variables.action === "delete" ? "Catatan presensi dihapus" : variables.action === "lock" ? "Catatan presensi dikunci" : variables.action === "unlock" ? "Catatan presensi dibuka" : "Presensi dihitung ulang");
      await queryClient.invalidateQueries({ queryKey: ["attendance"] });
      await queryClient.invalidateQueries({ queryKey: ["attendance-summary"] });
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (!canView) return <UnauthorizedState />;
  if (attendance.isLoading || summary.isLoading) return <LoadingState label="Memuat data presensi" />;
  if (attendance.isError || summary.isError) return <ErrorState message={getErrorMessage(attendance.error ?? summary.error)} retry={() => { void attendance.refetch(); void summary.refetch(); }} />;

  const data = summary.data;
  const count = (key: keyof AttendanceSummaryData) => {
    const value = data?.[key];
    return typeof value === "number" ? value : 0;
  };
  const baseHref = `/api/proxy/attendance/export?date_from=${date}&date_to=${date}${branchId ? `&branch_id=${encodeURIComponent(branchId)}` : ""}`;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader eyebrow="Operasional" title="Presensi" description="Pantau kehadiran, tindak lanjuti koreksi, dan kelola catatan presensi tenant." />
        <div className="flex gap-2">
          <Button asChild variant="outline"><a href={baseHref}><Download className="mr-2 size-4" />Export</a></Button>
          {canCorrect ? <Button onClick={() => setManualOpen(true)}><Plus className="mr-2 size-4" />Presensi Manual</Button> : null}
        </div>
      </div>
      <Phase2Navigation permissions={permissions} />

      <Card className="shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <label className="sr-only" htmlFor="attendance-date">Tanggal presensi</label>
          <Input id="attendance-date" type="date" className="w-full md:w-40" value={date} onChange={(event) => setDate(event.target.value)} />
          <label className="sr-only" htmlFor="attendance-branch">Filter cabang</label>
          <select id="attendance-branch" className="h-9 rounded-lg border border-input bg-background px-3 text-sm" value={branchId} onChange={(event) => setBranchId(event.target.value)}>
            <option value="">Semua cabang</option>
            {(branches.data?.data ?? []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </select>
          <label className="sr-only" htmlFor="attendance-status">Filter status</label>
          <select id="attendance-status" className="h-9 rounded-lg border border-input bg-background px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Semua status</option>
            {Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input aria-label="Cari karyawan" className="pl-9" placeholder="Cari karyawan..." value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Button variant="ghost" onClick={() => { setDate(today()); setStatus(""); setBranchId(""); setSearch(""); }}>Reset filter</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <SummaryPill label="Hadir" value={count("present")} tone="emerald" />
        <SummaryPill label="Terlambat" value={count("late")} tone="amber" />
        <SummaryPill label="Izin" value={count("permit") + count("sick") + count("business_trip")} tone="sky" />
        <SummaryPill label="Cuti" value={count("on_leave")} tone="violet" />
        <SummaryPill label="Alpha" value={count("absent")} tone="red" />
        <SummaryPill label="Belum lengkap" value={count("incomplete")} tone="slate" />
      </div>

      {canCorrect ? <Card className="border-amber-200 bg-amber-50/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
          <div><CardTitle className="text-sm text-amber-900">Koreksi Presensi</CardTitle><p className="mt-1 text-xs text-amber-800">{pendingCorrections.length} menunggu persetujuan</p></div>
          <a href="#daftar-koreksi" className="text-sm font-medium text-amber-800 underline-offset-4 hover:underline">Lihat semua</a>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          {corrections.isError ? <p className="text-sm text-amber-900">Daftar koreksi tidak dapat dimuat.</p> : pendingCorrections.length === 0 ? <p className="text-sm text-amber-900">Tidak ada koreksi yang menunggu persetujuan.</p> : pendingCorrections.slice(0, 4).map((correction) => <CorrectionCard key={correction.id} correction={correction} pending={review.isPending} onDecision={(decision) => review.mutate({ id: correction.id, decision })} />)}
        </CardContent>
      </Card> : null}

      <Card className="shadow-sm">
        <CardHeader className="flex-row items-center justify-between"><CardTitle>Rekap Presensi Harian</CardTitle><span className="text-xs text-muted-foreground">{getPagination(attendance.data?.meta ?? {})?.total ?? filteredRows.length} catatan</span></CardHeader>
        <CardContent className="p-0">
          {filteredRows.length === 0 ? <div className="p-5"><EmptyState title="Belum ada catatan presensi" description="Tidak ada data untuk filter dan tanggal yang dipilih." /></div> : <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead><tr className="bg-muted/50 text-left text-xs text-muted-foreground"><th className="px-4 py-3 font-medium">Karyawan</th><th className="px-4 py-3 font-medium">Tanggal</th><th className="px-4 py-3 font-medium">Shift</th><th className="px-4 py-3 font-medium">Check-in</th><th className="px-4 py-3 font-medium">Check-out</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Terlambat</th><th className="px-4 py-3 font-medium">Kerja</th><th className="px-4 py-3 font-medium">Jarak</th><th className="px-4 py-3 font-medium">Aksi</th></tr></thead>
              <tbody>{filteredRows.map((row) => <tr key={row.id} className="border-t border-border/70">
                <td className="px-4 py-3"><p className="font-medium">{employeeName(row)}</p><p className="text-xs text-muted-foreground">{row.employee_id}</p></td>
                <td className="px-4 py-3">{formatDate(row.work_date)}</td>
                <td className="px-4 py-3">{row.work_schedule?.code ?? "—"}</td>
                <td className="px-4 py-3">{formatTime(row.check_in_at)}{row.check_in_source ? <span className="text-xs text-muted-foreground"> · {row.check_in_source}</span> : null}</td>
                <td className="px-4 py-3">{row.check_out_at ? formatTime(row.check_out_at) : "Belum checkout"}{row.check_out_source ? <span className="text-xs text-muted-foreground"> · {row.check_out_source}</span> : null}</td>
                <td className="px-4 py-3"><Badge className={`border-transparent ${statusTone[row.status] ?? "bg-muted text-muted-foreground"}`}>{statusLabels[row.status] ?? row.status}</Badge></td>
                <td className="px-4 py-3">{row.late_minutes > 0 ? `${row.late_minutes} mnt` : "—"}</td>
                <td className="px-4 py-3">{row.work_minutes > 0 ? `${Math.floor(row.work_minutes / 60)}j ${row.work_minutes % 60}m` : "—"}</td>
                <td className="px-4 py-3">{row.check_in_distance_m !== null && row.check_in_distance_m !== undefined ? `${Math.round(row.check_in_distance_m)} m` : "—"}</td>
                <td className="px-4 py-3"><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Aksi presensi ${employeeName(row)}`} disabled={recordAction.isPending}><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                  {canCorrect ? <><DropdownMenuItem disabled={recordAction.isPending} onSelect={() => recordAction.mutate({ id: row.id, action: "recalculate" })}><RefreshCw />Hitung ulang</DropdownMenuItem><DropdownMenuItem variant="destructive" disabled={recordAction.isPending} onSelect={() => { if (window.confirm(`Hapus catatan presensi ${employeeName(row)} tanggal ${formatDate(row.work_date)}?`)) recordAction.mutate({ id: row.id, action: "delete" }); }}><Trash2 />Hapus catatan</DropdownMenuItem></> : null}
                  {canLock ? <DropdownMenuItem disabled={recordAction.isPending} onSelect={() => recordAction.mutate({ id: row.id, action: row.is_locked ? "unlock" : "lock" })}>{row.is_locked ? <UnlockKeyhole /> : <LockKeyhole />}{row.is_locked ? "Buka kunci" : "Kunci presensi"}</DropdownMenuItem> : null}
                  {!canCorrect && !canLock ? <DropdownMenuItem disabled>Akses hanya lihat</DropdownMenuItem> : null}
                </DropdownMenuContent></DropdownMenu></td>
              </tr>)}</tbody>
            </table>
          </div>}
        </CardContent>
      </Card>

      {canCorrect ? <section id="daftar-koreksi" className="scroll-mt-24"><Card className="shadow-sm"><CardHeader><CardTitle>Daftar koreksi terbaru</CardTitle></CardHeader><CardContent className="space-y-3">
        {pendingCorrections.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pengajuan koreksi.</p> : pendingCorrections.map((correction) => <CorrectionCard key={correction.id} correction={correction} pending={review.isPending} onDecision={(decision) => review.mutate({ id: correction.id, decision })} />)}
      </CardContent></Card></section> : null}
      {manualOpen && canCorrect ? <ManualAttendanceDialog employees={employees.data?.data ?? []} loading={employees.isLoading} timezone={timezone} onClose={() => setManualOpen(false)} /> : null}
    </div>
  );
}

function SummaryPill({ label, value, tone }: { label: string; value: number; tone: string }) {
  const dots: Record<string, string> = { emerald: "bg-emerald-500", amber: "bg-amber-500", sky: "bg-sky-500", violet: "bg-violet-500", red: "bg-red-500", slate: "bg-slate-500" };
  return <Card className="gap-2 py-3 shadow-sm"><CardContent className="flex items-center gap-2 px-3"><span className={`size-2 shrink-0 rounded-full ${dots[tone]}`} /><span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{label}</span><strong className="text-sm">{value}</strong></CardContent></Card>;
}

function CorrectionCard({ correction, pending, onDecision }: { correction: AttendanceCorrection; pending: boolean; onDecision: (decision: "approve" | "reject") => void }) {
  return <article className="rounded-lg border border-amber-200 bg-card p-3">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{employeeName(correction)}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(correction.work_date)}</p></div><Badge variant="outline" className="shrink-0">Menunggu</Badge></div>
    <p className="mt-2 text-sm">{correction.requested_check_in_at ? `Check-in → ${formatDateTime(correction.requested_check_in_at)}` : "Check-in tidak diubah"} <span className="text-muted-foreground">·</span> {correction.requested_check_out_at ? `Check-out → ${formatDateTime(correction.requested_check_out_at)}` : "Check-out tidak diubah"}</p>
    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">Alasan: {correction.reason}</p>
    <div className="mt-3 flex gap-2"><Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" disabled={pending} onClick={() => onDecision("approve")}>Setujui</Button><Button size="sm" variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" disabled={pending} onClick={() => onDecision("reject")}>Tolak</Button></div>
  </article>;
}

function ManualAttendanceDialog({ employees, loading, timezone, onClose }: { employees: Employee[]; loading: boolean; timezone: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [workDate, setWorkDate] = useState(today());
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [notes, setNotes] = useState("");
  const create = useMutation({
    mutationFn: () => apiFetch<AttendanceRecord>("attendance", { method: "POST", body: JSON.stringify({ employee_id: employeeId, work_date: workDate, check_in_at: checkIn ? localTimeToUtc(workDate, checkIn, timezone) : null, check_out_at: checkOut ? localTimeToUtc(workDate, checkOut, timezone) : null, notes: notes || null }) }),
    onSuccess: async () => { toast.success("Catatan presensi manual dibuat"); await queryClient.invalidateQueries({ queryKey: ["attendance"] }); await queryClient.invalidateQueries({ queryKey: ["attendance-summary"] }); onClose(); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="manual-attendance-title" className="w-full max-w-lg rounded-xl border bg-card p-5 shadow-xl">
      <div className="flex items-start justify-between"><div><h2 id="manual-attendance-title" className="text-lg font-semibold">Presensi Manual</h2><p className="mt-1 text-sm text-muted-foreground">Catat presensi sesuai data dan alasan yang tervalidasi.</p></div><Button variant="ghost" size="icon" aria-label="Tutup" onClick={onClose}><X className="size-4" /></Button></div>
      <form className="mt-5 space-y-4" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
        <Field label="Karyawan"><select required className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">{loading ? "Memuat karyawan…" : "Pilih karyawan"}</option>{employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.full_name} · {employee.employee_number}</option>)}</select></Field>
        <Field label="Tanggal"><Input required type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} /></Field>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Check-in"><Input type="time" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} /></Field><Field label="Check-out"><Input type="time" value={checkOut} onChange={(event) => setCheckOut(event.target.value)} /></Field></div>
        <Field label="Catatan"><textarea className="min-h-20 w-full rounded-lg border border-input bg-background p-3 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} /></Field>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={create.isPending || loading || !employeeId}>{create.isPending ? "Menyimpan…" : "Simpan presensi"}</Button></div>
      </form>
    </section>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block space-y-1.5 text-sm"><span className="font-medium">{label}</span>{children}</label>; }
function employeeName(record: AttendanceRecord | AttendanceCorrection) { return typeof record.employee === "string" ? record.employee : record.employee.full_name; }
function today() { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatDate(date: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${date}T00:00:00`)); }
function formatTime(value: string | null) { return value ? new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—"; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }

function localTimeToUtc(date: string, time: string, timezone: string) {
  const localAsUtc = new Date(`${date}T${time}:00Z`);
  const getOffset = (instant: Date) => {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(instant);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const representedAsUtc = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
    return representedAsUtc - instant.getTime();
  };
  const firstGuess = new Date(localAsUtc.getTime() - getOffset(localAsUtc));
  return new Date(localAsUtc.getTime() - getOffset(firstGuess)).toISOString();
}
