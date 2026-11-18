"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, RefreshCw, ShieldCheck, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { apiFetchEnvelope, getPagination } from "@/lib/api/client";
import type { AuditLog, Pagination } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";
import { useUrlQueryState } from "@/lib/use-url-query-state";

const commonActions = [
  "payroll_run.created", "payroll_run.calculate_queued", "payroll_run.recalculate_queued", "payroll_run.reviewed", "payroll_run.locked", "payroll_run.unlocked", "payroll_run.published", "payroll_run.cancelled",
  "salary.created", "salary.updated", "salary_component.created", "salary_component.updated", "salary_component.deleted", "bpjs_settings.updated", "tax_settings.updated", "overtime_rules.updated",
  "overtime_request.created", "overtime_request.approved", "overtime_request.rejected", "salary_adjustment.created", "salary_adjustment.approved", "supplementary_run.created", "supplementary_run.approved", "supplementary_run.paid", "payroll_lock.unlocked",
  "leave.created", "leave.submitted", "leave.cancelled", "approval.approved", "approval.rejected", "attendance.checked_in", "attendance.checked_out", "attendance.updated", "employee.created", "employee.updated", "identity.user_created", "identity.role_permissions_updated",
];

export function AdminAuditView({ permissions }: { permissions: string[] }) {
  if (!hasPermission(permissions, "audit.view")) return <UnauthorizedState description="Permission audit.view diperlukan untuk membaca audit log tenant." />;
  return <AuditContent />;
}

function AuditContent() {
  const { values, update } = useUrlQueryState();
  const action = values.get("action") ?? "";
  const actorId = values.get("actor_id") ?? "";
  const subjectType = values.get("subject_type") ?? "";
  const subjectId = values.get("subject_id") ?? "";
  const dateFrom = values.get("date_from") ?? "";
  const dateTo = values.get("date_to") ?? "";
  const sort = values.get("sort") ?? "-created_at";
  const page = Math.max(1, Number(values.get("page") ?? "1") || 1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const params = new URLSearchParams({ page: String(page), per_page: "50", sort });
  if (action.trim()) params.set("action", action.trim());
  if (actorId.trim().length === 26) params.set("actor_id", actorId.trim());
  if (subjectType.trim()) params.set("subject_type", subjectType.trim());
  if (subjectId.trim().length === 26) params.set("subject_id", subjectId.trim());
  if (dateFrom) params.set("date_from", dateFrom);
  if (dateTo) params.set("date_to", dateTo);

  const query = useQuery({ queryKey: ["audit-logs", action, actorId, subjectType, subjectId, dateFrom, dateTo, sort, page], queryFn: () => apiFetchEnvelope<AuditLog[]>(`audit-logs?${params}`) });
  const rows = query.data?.data ?? [];
  const pagination = getPagination(query.data?.meta ?? {});

  function resetFilters() {
    update({ action: null, actor_id: null, subject_type: null, subject_id: null, date_from: null, date_to: null, sort: null, page: null });
  }

  function setFilter(key: string, value: string) {
    update({ [key]: value, page: "1" });
  }

  return <div className="flex flex-col gap-5">
    <PageHeader eyebrow="Keamanan · Audit" title="Audit Log" description="Jejak aktivitas tenant untuk investigasi, kepatuhan, dan review perubahan sensitif." />
    <Card>
      <CardHeader><CardTitle>Filter Audit</CardTitle><CardDescription>Filter action bersifat pencocokan persis. Tanggal memakai format YYYY-MM-DD.</CardDescription></CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">Action</span><Input list="audit-actions" value={action} onChange={(event) => setFilter("action", event.target.value)} placeholder="payroll_run.locked" /><datalist id="audit-actions">{commonActions.map((item) => <option key={item} value={item} />)}</datalist></label>
          <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">Actor ID</span><Input maxLength={26} value={actorId} onChange={(event) => setFilter("actor_id", event.target.value)} placeholder="ULID user (26 karakter)" /><span className="text-xs text-muted-foreground">Terapkan setelah tepat 26 karakter.</span></label>
          <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">Subject type</span><Input value={subjectType} onChange={(event) => setFilter("subject_type", event.target.value)} placeholder="App\Domain\Payroll\Models\PayrollRun" /></label>
          <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">Subject ID</span><Input maxLength={26} value={subjectId} onChange={(event) => setFilter("subject_id", event.target.value)} placeholder="ULID subject (26 karakter)" /><span className="text-xs text-muted-foreground">Terapkan setelah tepat 26 karakter.</span></label>
          <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">Dari tanggal</span><Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setFilter("date_from", event.target.value)} /></label>
          <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">Sampai tanggal</span><Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setFilter("date_to", event.target.value)} /></label>
          <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">Urutkan</span><select className="h-9 rounded-lg border bg-background px-3 text-sm" value={sort} onChange={(event) => setFilter("sort", event.target.value)}><option value="-created_at">Terbaru</option><option value="created_at">Terlama</option><option value="action">Action A–Z</option><option value="-action">Action Z–A</option></select></label>
          <div className="flex items-end gap-2"><Button variant="outline" onClick={resetFilters}>Reset Filter</Button><Button variant="outline" aria-label="Muat ulang audit log" onClick={() => void query.refetch()}><RefreshCw /></Button></div>
        </div>
      </CardContent>
    </Card>

    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Jejak Audit</CardTitle><CardDescription>{pagination?.total ?? rows.length} event ditemukan{pagination ? ` · halaman ${pagination.current_page} dari ${pagination.last_page}` : ""}.</CardDescription></div><Badge variant="outline"><ShieldCheck className="mr-1 size-3" />Tenant-scoped</Badge></CardHeader>
      <CardContent>
        {query.isLoading ? <LoadingState label="Memuat audit log" /> : query.isError ? <ErrorState message={getErrorMessage(query.error)} retry={() => void query.refetch()} /> : rows.length === 0 ? <EmptyState title="Tidak ada audit log" description="Ubah rentang tanggal atau filter untuk melihat event lain." /> : <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-4 font-medium">Waktu</th><th className="py-3 pr-4 font-medium">Action</th><th className="py-3 pr-4 font-medium">Actor</th><th className="py-3 pr-4 font-medium">Subject</th><th className="py-3 pr-4 font-medium">IP</th><th className="py-3 font-medium">Detail</th></tr></thead><tbody className="divide-y">{rows.map((log) => <tr key={log.id}><td className="whitespace-nowrap py-3 pr-4 text-xs text-muted-foreground">{formatAuditTime(log.created_at)}</td><td className="py-3 pr-4 font-medium">{log.action}</td><td className="py-3 pr-4 font-mono text-xs">{log.actor_id ? shortId(log.actor_id) : "sistem"}</td><td className="py-3 pr-4 text-xs text-muted-foreground"><span className="block font-mono">{log.subject_type ? shortSubject(log.subject_type) : "—"}</span>{log.subject_id ? shortId(log.subject_id) : ""}</td><td className="py-3 pr-4 font-mono text-xs text-muted-foreground">{log.ip ?? "—"}</td><td className="py-3"><Button size="sm" variant="outline" onClick={() => setSelected(log)}>Lihat</Button></td></tr>)}</tbody></table></div>}
        {pagination && pagination.last_page > 1 ? <PaginationControls pagination={pagination} onPrevious={() => update({ page: String(Math.max(1, page - 1)) })} onNext={() => update({ page: String(Math.min(pagination.last_page, page + 1)) })} /> : null}
      </CardContent>
    </Card>

    {selected ? <AuditDetail log={selected} onClose={() => setSelected(null)} /> : null}
  </div>;
}

function PaginationControls({ pagination, onPrevious, onNext }: { pagination: Pagination; onPrevious: () => void; onNext: () => void }) {
  return <div className="mt-4 flex items-center justify-between gap-3 border-t pt-4 text-sm"><p className="text-muted-foreground">Menampilkan {pagination.from ?? 0}–{pagination.to ?? 0} dari {pagination.total}</p><div className="flex gap-2"><Button variant="outline" size="sm" disabled={pagination.current_page <= 1} onClick={onPrevious}><ChevronLeft data-icon="inline-start" />Sebelumnya</Button><Button variant="outline" size="sm" disabled={pagination.current_page >= pagination.last_page} onClick={onNext}>Berikutnya<ChevronRight data-icon="inline-end" /></Button></div></div>;
}

function AuditDetail({ log, onClose }: { log: AuditLog; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusable = panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  return <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
    <button tabIndex={-1} className="absolute inset-0 bg-foreground/30" aria-label="Tutup detail audit" onClick={onClose} />
    <div ref={panelRef} className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l bg-card shadow-xl">
      <div className="sticky top-0 flex items-start justify-between gap-3 border-b bg-card p-5">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Detail Audit</p><h2 id="audit-detail-title" className="mt-1 break-words text-lg font-semibold">{log.action}</h2><p className="mt-1 text-xs text-muted-foreground">{formatAuditTime(log.created_at)} · {log.id}</p></div>
        <Button ref={closeRef} variant="ghost" size="icon" aria-label="Tutup detail audit" onClick={onClose}><X /></Button>
      </div>
      <div className="flex flex-col gap-5 p-5 text-sm">
        <dl className="grid grid-cols-[130px_minmax(0,1fr)] gap-x-3 gap-y-2">
          <dt className="text-muted-foreground">Actor ID</dt><dd className="break-all font-mono text-xs">{log.actor_id ?? "sistem"}</dd>
          <dt className="text-muted-foreground">Subject type</dt><dd className="break-all font-mono text-xs">{log.subject_type ?? "—"}</dd>
          <dt className="text-muted-foreground">Subject ID</dt><dd className="break-all font-mono text-xs">{log.subject_id ?? "—"}</dd>
          <dt className="text-muted-foreground">IP</dt><dd className="font-mono text-xs">{log.ip ?? "—"}</dd>
          <dt className="text-muted-foreground">Request ID</dt><dd className="break-all font-mono text-xs">{log.request_id ?? "—"}</dd>
          <dt className="text-muted-foreground">User agent</dt><dd className="break-words text-xs">{log.user_agent ?? "—"}</dd>
        </dl>
        <AuditPayload title="Before" value={log.before} />
        <AuditPayload title="After" value={log.after} />
      </div>
    </div>
  </div>;
}

function AuditPayload({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  return <div><h3 className="font-semibold">{title}</h3>{value === null ? <p className="mt-1 rounded-lg border border-dashed p-3 text-xs text-muted-foreground">Tidak ada payload.</p> : <pre className="mt-2 max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3 text-xs leading-5">{JSON.stringify(value, null, 2)}</pre>}</div>;
}

function formatAuditTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
}

function shortSubject(subject: string) {
  const parts = subject.split("\\");
  return parts[parts.length - 1] ?? subject;
}
