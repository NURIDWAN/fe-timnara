"use client";

import { useQueries } from "@tanstack/react-query";
import { Check, CircleUserRound, Clock3, Heart } from "lucide-react";
import { apiFetch, apiFetchEnvelope, getPagination } from "@/lib/api/client";
import type { AttendanceRecord, AttendanceSummaryData, Employee } from "@/lib/api/types";
import { ErrorState, LoadingState, getErrorMessage } from "@/components/page-states";

type DayPoint = { label: string; present: number; late: number };
const statusLabels: Record<string, string> = { present: "Hadir", late: "Terlambat", on_leave: "Izin / Cuti", absent: "Alpha", sick: "Sakit", permit: "Izin", business_trip: "Dinas", holiday: "Libur", off: "Libur", incomplete: "Tidak lengkap" };

export function DashboardView({ permissions }: { permissions: string[] }) {
  const canViewEmployees = permissions.some((permission) => permission === "*" || permission === "employee.view" || permission === "employee.*");
  const canViewAttendance = permissions.some((permission) => permission === "*" || permission === "attendance.view" || permission === "attendance.*");
  const today = new Date();
  const todayString = formatDate(today);
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - 6);
  const rangeStartString = formatDate(rangeStart);
  const results = useQueries({ queries: [
    { queryKey: ["dashboard", "employees"], queryFn: async () => apiFetchEnvelope<Employee[]>("employees?per_page=1&is_active=true"), enabled: canViewEmployees },
    { queryKey: ["dashboard", "summary", todayString], queryFn: () => apiFetch<AttendanceSummaryData>(`attendance/summary?date=${todayString}`), enabled: canViewAttendance },
    { queryKey: ["dashboard", "attendance", rangeStartString, todayString], queryFn: async () => { const response = await apiFetchEnvelope<AttendanceRecord[]>(`attendance?date_from=${rangeStartString}&date_to=${todayString}&per_page=100&page=1`); return response.data ?? []; }, enabled: canViewAttendance },
  ] });
  const employees = results[0];
  const summary = results[1];
  const attendance = results[2];
  if (results.some((result) => result.isLoading)) return <LoadingState label="Memuat dashboard" />;
  if (results.some((result) => result.isError)) return <ErrorState message={getErrorMessage(results.find((result) => result.isError)?.error)} retry={() => results.forEach((result) => void result.refetch())} />;

  const totalEmployees = getPagination(employees.data?.meta ?? {})?.total ?? 0;
  const summaryData = (summary.data ?? {}) as AttendanceSummaryData;
  const records = attendance.data ?? [];
  const trend = makeTrend(records, rangeStart);
  const present = summaryData.present ?? countStatus(records, "present");
  const late = summaryData.late ?? countStatus(records, "late");
  const leave = summaryData.on_leave ?? countStatus(records, "on_leave");
  const absent = summaryData.absent ?? countStatus(records, "absent");
  const totalComposition = Math.max(present + late + leave + absent, 1);

  return <div className="space-y-6"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Total Karyawan" value={canViewEmployees ? String(totalEmployees) : "—"} caption="Karyawan aktif" icon={CircleUserRound} tone="blue" /><StatCard label="Hadir Hari Ini" value={canViewAttendance ? String(present) : "—"} caption={totalEmployees ? `${Math.round((present / totalEmployees) * 100)}% dari total` : "Data presensi hari ini"} icon={Check} tone="sky" /><StatCard label="Izin / Cuti" value={canViewAttendance ? String(leave) : "—"} caption="Status hari ini" icon={Heart} tone="amber" /><StatCard label="Terlambat" value={canViewAttendance ? String(late) : "—"} caption="Status hari ini" icon={Clock3} tone="red" /></div><div className="grid gap-4 lg:grid-cols-[minmax(0,1.72fr)_minmax(320px,1fr)]"><TrendCard trend={trend} /><CompositionCard present={present} late={late} leave={leave} absent={absent} total={totalComposition} /></div><RecentAttendance records={records.slice(0, 5)} /></div>;
}

function StatCard({ label, value, caption, icon: Icon, tone }: { label: string; value: string; caption: string; icon: typeof Check; tone: "blue" | "sky" | "amber" | "red" }) {
  const tones = { blue: "bg-blue-50 text-blue-600", sky: "bg-sky-50 text-sky-500", amber: "bg-amber-50 text-amber-500", red: "bg-red-50 text-red-500" };
  return <div className="rounded-xl border border-border bg-card p-5 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-2xl font-bold tracking-tight text-foreground">{value}</p><p className="mt-2 text-sm text-muted-foreground">{label}</p></div><div className={`rounded-lg p-2.5 ${tones[tone]}`}><Icon className="size-4" /></div></div><p className="mt-5 text-xs text-muted-foreground">{caption}</p></div>;
}

function TrendCard({ trend }: { trend: DayPoint[] }) {
  const max = Math.max(...trend.flatMap((item) => [item.present, item.late]), 1);
  return <section className="rounded-xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center justify-between gap-4"><h2 className="text-base font-semibold">Tren Presensi — 7 Hari Terakhir</h2><div className="flex gap-3 text-xs text-muted-foreground"><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-blue-600" />Hadir</span><span className="flex items-center gap-1"><i className="size-2 rounded-full bg-amber-500" />Terlambat</span></div></div><div className="mt-6 flex h-56 items-end justify-between gap-2 px-2 sm:gap-5">{trend.map((item) => <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="flex h-full items-end gap-1"><div className="w-3 rounded-t bg-blue-600 sm:w-4" style={{ height: `${Math.max((item.present / max) * 82, item.present ? 5 : 0)}%` }} title={`${item.present} hadir`} /><div className="w-3 rounded-t bg-amber-500 sm:w-4" style={{ height: `${Math.max((item.late / max) * 82, item.late ? 5 : 0)}%` }} title={`${item.late} terlambat`} /></div><span className="text-[11px] text-slate-400">{item.label}</span></div>)}</div></section>;
}

function CompositionCard({ present, late, leave, absent, total }: { present: number; late: number; leave: number; absent: number; total: number }) {
  const presentEnd = (present / total) * 100;
  const leaveEnd = presentEnd + (leave / total) * 100;
  const lateEnd = leaveEnd + (late / total) * 100;
  const gradient = `conic-gradient(#2563eb 0 ${presentEnd}%, #f59e0b ${presentEnd}% ${leaveEnd}%, #dc2626 ${leaveEnd}% ${lateEnd}%, #cbd5e1 ${lateEnd}% 100%)`;
  return <section className="rounded-xl border border-border bg-card p-6 shadow-sm"><h2 className="text-base font-semibold">Komposisi Kehadiran</h2><div className="mt-6 flex flex-col items-center justify-center gap-6 sm:flex-row"><div className="relative size-36 shrink-0 rounded-full" style={{ background: gradient }}><div className="absolute inset-7 rounded-full bg-card" /></div><div className="w-full space-y-3 text-sm"><Legend color="bg-blue-600" label="Hadir" value={present} total={total} /><Legend color="bg-amber-500" label="Izin / Cuti" value={leave} total={total} /><Legend color="bg-red-600" label="Terlambat" value={late} total={total} /><Legend color="bg-slate-300" label="Alpha" value={absent} total={total} /></div></div></section>;
}

function Legend({ color, label, value, total }: { color: string; label: string; value: number; total: number }) { return <div className="flex items-center gap-2"><i className={`size-2 rounded-full ${color}`} /><span className="flex-1 text-foreground">{label}</span><span className="text-muted-foreground">{value} · {Math.round((value / total) * 100)}%</span></div>; }

function RecentAttendance({ records }: { records: AttendanceRecord[] }) {
  return <section className="rounded-xl border border-border bg-card p-6 shadow-sm"><div className="flex items-center justify-between gap-4"><h2 className="text-base font-semibold">Log Presensi Terbaru</h2><span className="text-sm font-medium text-primary">Lihat semua →</span></div>{records.length === 0 ? <div className="mt-5 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada log presensi untuk periode ini.</div> : <div className="mt-5 overflow-x-auto rounded-lg border border-border"><table className="w-full min-w-[760px] text-sm"><thead><tr className="bg-slate-50 text-left text-xs text-slate-500"><th className="px-4 py-3 font-medium">Karyawan</th><th className="px-4 py-3 font-medium">Tanggal</th><th className="px-4 py-3 font-medium">Check-in</th><th className="px-4 py-3 font-medium">Check-out</th><th className="px-4 py-3 font-medium">Lokasi</th><th className="px-4 py-3 font-medium">Status</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-t border-slate-100"><td className="px-4 py-3 font-medium">{employeeName(record)}</td><td className="px-4 py-3 text-muted-foreground">{formatShortDate(record.work_date)}</td><td className="px-4 py-3">{formatTime(record.check_in_at)}</td><td className="px-4 py-3">{formatTime(record.check_out_at)}</td><td className="px-4 py-3 text-muted-foreground"><span className="mr-2 inline-block size-2 rounded-full bg-emerald-500" />{record.check_in_source ?? "—"}</td><td className="px-4 py-3"><StatusBadge status={record.status} /></td></tr>)}</tbody></table></div>}</section>;
}

function StatusBadge({ status }: { status: string }) { const styles: Record<string, string> = { present: "bg-emerald-50 text-emerald-600", late: "bg-amber-50 text-amber-600", on_leave: "bg-blue-50 text-blue-600", absent: "bg-red-50 text-red-600" }; return <span className={`inline-flex min-w-24 justify-center rounded-full px-3 py-1 text-xs font-medium ${styles[status] ?? "bg-slate-100 text-slate-600"}`}>{statusLabels[status] ?? status}</span>; }
function employeeName(record: AttendanceRecord) { return typeof record.employee === "string" ? record.employee : record.employee.full_name; }
function formatTime(value: string | null) { return value ? new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—"; }
function formatShortDate(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00`)); }
function formatDate(value: Date) { return value.toISOString().slice(0, 10); }
function countStatus(records: AttendanceRecord[], status: string) { return records.filter((record) => record.status === status).length; }
function makeTrend(records: AttendanceRecord[], start: Date) { return Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(start.getDate() + index); const key = formatDate(date); const dayRecords = records.filter((record) => record.work_date === key); return { label: new Intl.DateTimeFormat("id-ID", { weekday: "short" }).format(date).replace(".", ""), present: dayRecords.filter((record) => record.status === "present").length, late: dayRecords.filter((record) => record.status === "late").length }; }); }
