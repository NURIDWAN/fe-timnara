"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { apiFetch, apiFetchEnvelope } from "@/lib/api/client";
import type { BpjsSetting, OvertimeRule, TaxBracket, TaxSetting, TaxTerRate, UpdateBpjsSettingsRequest, UpdateOvertimeRulesRequest, UpdateTaxBracketsRequest, UpdateTaxSettingRequest, UpdateTaxTerRatesRequest } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";
import { Field, PayrollShell, StatusBadge } from "@/components/payroll/payroll-shared";

type BpjsRow = { type: BpjsSetting["type"]; employee_rate: number; employer_rate: number; salary_cap: number | null; min_base: number | null; effective_from: string; is_active: boolean };
type TerRow = { category: "A" | "B" | "C"; income_from: number; income_to: number | null; rate_percent: number; is_active: boolean };
type BracketRow = { pkp_from: number; pkp_to: number | null; rate_percent: number; is_active: boolean };
type OvertimeRow = { day_type: OvertimeRule["day_type"]; hour_from: number; hour_to: number; multiplier: number; is_active: boolean };

const bpjsTypes: Array<{ value: BpjsSetting["type"]; label: string }> = [
  { value: "health", label: "Kesehatan" },
  { value: "jht", label: "JHT" },
  { value: "jp", label: "JP" },
  { value: "jkk", label: "JKK" },
  { value: "jkm", label: "JKM" },
];

const today = new Date().toISOString().slice(0, 10);

export function PayrollSettingsView({ permissions }: { permissions: string[] }) {
  if (!hasPermission(permissions, "payroll.view")) return <UnauthorizedState />;
  return <PayrollShell permissions={permissions} current="/admin/payroll/settings" title="Pengaturan Payroll" description="BPJS, PPh 21, TER, braket progresif, dan aturan lembur tenant."><SettingsContent permissions={permissions} /></PayrollShell>;
}

function SettingsContent({ permissions }: { permissions: string[] }) {
  const canManage = hasPermission(permissions, "payroll.manage");
  return <div className="flex flex-col gap-4">
    <BpjsSection canManage={canManage} />
    <TaxSection canManage={canManage} />
    <OvertimeSection canManage={canManage} />
  </div>;
}

function BpjsSection({ canManage }: { canManage: boolean }) {
  const client = useQueryClient();
  const [rows, setRows] = useState<BpjsRow[]>([]);
  const query = useQuery({ queryKey: ["payroll-bpjs-settings"], queryFn: () => apiFetchEnvelope<BpjsSetting[]>("payroll/bpjs-settings") });

  useEffect(() => {
    if (!query.data?.data) return;
    const existing = new Map(query.data.data.map((item) => [item.type, item]));
    setRows(bpjsTypes.map(({ value }) => {
      const item = existing.get(value);
      return item ? { type: item.type, employee_rate: item.employee_rate, employer_rate: item.employer_rate, salary_cap: item.salary_cap ?? null, min_base: item.min_base ?? null, effective_from: item.effective_from, is_active: item.is_active } : { type: value, employee_rate: 0, employer_rate: 0, salary_cap: null, min_base: null, effective_from: today, is_active: false };
    }));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => apiFetch<BpjsSetting[]>("payroll/bpjs-settings", { method: "PUT", body: JSON.stringify({ settings: rows as UpdateBpjsSettingsRequest["settings"] } satisfies UpdateBpjsSettingsRequest) }),
    onSuccess: async () => { toast.success("Pengaturan BPJS diperbarui"); await client.invalidateQueries({ queryKey: ["payroll-bpjs-settings"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (query.isLoading) return <LoadingState label="Memuat pengaturan BPJS" />;
  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} retry={() => void query.refetch()} />;

  return <Card>
    <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>BPJS Settings</CardTitle><CardDescription>PUT /payroll/bpjs-settings · tipe yang tidak dikirim akan dinonaktifkan oleh API.</CardDescription></div><Button disabled={!canManage || save.isPending} onClick={() => save.mutate()}><Save data-icon="inline-start" />Simpan BPJS</Button></CardHeader>
    <CardContent>
      <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 pr-3 font-medium">Tipe</th><th className="py-2 pr-3 font-medium">Karyawan %</th><th className="py-2 pr-3 font-medium">Perusahaan %</th><th className="py-2 pr-3 font-medium">Salary cap</th><th className="py-2 pr-3 font-medium">Min base</th><th className="py-2 pr-3 font-medium">Efektif</th><th className="py-2 pr-3 font-medium">Status</th></tr></thead><tbody className="divide-y">{rows.map((row, index) => <tr key={row.type}><td className="py-2 pr-3 font-medium">{bpjsTypes.find((item) => item.value === row.type)?.label ?? row.type}</td><td className="py-2 pr-3"><Input aria-label={`Rate karyawan ${row.type}`} type="number" min="0" max="100" step="0.01" value={row.employee_rate} onChange={(event) => updateRow(setRows, index, { employee_rate: Number(event.target.value) })} /></td><td className="py-2 pr-3"><Input aria-label={`Rate perusahaan ${row.type}`} type="number" min="0" max="100" step="0.01" value={row.employer_rate} onChange={(event) => updateRow(setRows, index, { employer_rate: Number(event.target.value) })} /></td><td className="py-2 pr-3"><Input aria-label={`Salary cap ${row.type}`} type="number" min="0" step="1000" value={row.salary_cap ?? ""} placeholder="Tanpa cap" onChange={(event) => updateRow(setRows, index, { salary_cap: event.target.value === "" ? null : Number(event.target.value) })} /></td><td className="py-2 pr-3"><Input aria-label={`Min base ${row.type}`} type="number" min="0" step="1000" value={row.min_base ?? ""} placeholder="Tanpa minimum" onChange={(event) => updateRow(setRows, index, { min_base: event.target.value === "" ? null : Number(event.target.value) })} /></td><td className="py-2 pr-3"><Input aria-label={`Efektif ${row.type}`} type="date" value={row.effective_from} onChange={(event) => updateRow(setRows, index, { effective_from: event.target.value })} /></td><td className="py-2 pr-3"><label className="flex items-center gap-2 text-xs"><input type="checkbox" className="size-4" checked={row.is_active} onChange={(event) => updateRow(setRows, index, { is_active: event.target.checked })} />Aktif</label></td></tr>)}</tbody></table></div>
      <p className="mt-3 text-xs text-muted-foreground">Rate 0–100. Salary cap dan min base berupa integer rupiah. Data yang tidak aktif tetap ditampilkan untuk transparansi.</p>
      {!canManage ? <p className="mt-2 text-xs text-muted-foreground">Permission payroll.manage diperlukan untuk menyimpan.</p> : null}
    </CardContent>
  </Card>;
}

function TaxSection({ canManage }: { canManage: boolean }) {
  return <Card><CardHeader><CardTitle>Pajak & TER</CardTitle><CardDescription>Pengaturan PPh 21, tarif TER, dan braket progresif. Simpan tiap bagian secara terpisah.</CardDescription></CardHeader><CardContent><div className="grid gap-6 xl:grid-cols-2"><TaxSettingForm canManage={canManage} /><TaxBracketEditor canManage={canManage} /></div><div className="mt-6"><TaxTerEditor canManage={canManage} /></div></CardContent></Card>;
}

function TaxSettingForm({ canManage }: { canManage: boolean }) {
  const client = useQueryClient();
  const [form, setForm] = useState<UpdateTaxSettingRequest>({ method: "ter", gross_up: false, position_allowance_percent: 5, position_allowance_max_monthly: 500000, is_active: true });
  const query = useQuery({ queryKey: ["payroll-tax-setting"], queryFn: () => apiFetchEnvelope<TaxSetting | null>("payroll/tax-settings") });

  useEffect(() => {
    const setting = query.data?.data;
    if (setting) setForm({ method: setting.method, gross_up: setting.gross_up, position_allowance_percent: setting.position_allowance_percent, position_allowance_max_monthly: setting.position_allowance_max_monthly, is_active: setting.is_active });
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => apiFetch<TaxSetting>("payroll/tax-settings", { method: "PUT", body: JSON.stringify(form) }),
    onSuccess: async () => { toast.success("Pengaturan PPh 21 diperbarui"); await client.invalidateQueries({ queryKey: ["payroll-tax-setting"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} retry={() => void query.refetch()} />;

  return <div className="rounded-xl border p-4">
    <h3 className="font-semibold">Tax Setting</h3>
    <p className="mb-3 text-xs text-muted-foreground">PUT /payroll/tax-settings · satu konfigurasi aktif per tenant.</p>
    {query.isLoading ? <LoadingState label="Memuat pengaturan pajak" /> : <><div className="grid gap-3 sm:grid-cols-2"><Field label="Metode"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.method} onChange={(event) => setForm((current) => ({ ...current, method: event.target.value as UpdateTaxSettingRequest["method"] }))}><option value="ter">TER</option><option value="progressive">Progresif</option><option value="none">Tanpa pajak</option></select></Field><Field label="Gross up"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.gross_up ? "1" : "0"} onChange={(event) => setForm((current) => ({ ...current, gross_up: event.target.value === "1" }))}><option value="0">Tidak</option><option value="1">Ya</option></select></Field><Field label="Position allowance %"><Input type="number" min="0" max="100" step="0.01" value={form.position_allowance_percent} onChange={(event) => setForm((current) => ({ ...current, position_allowance_percent: Number(event.target.value) }))} /></Field><Field label="Max bulanan"><Input type="number" min="0" step="1000" value={form.position_allowance_max_monthly} onChange={(event) => setForm((current) => ({ ...current, position_allowance_max_monthly: Number(event.target.value) }))} /></Field></div><div className="mt-3 flex items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" className="size-4" checked={form.is_active ?? true} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />Aktif</label><Button size="sm" disabled={!canManage || save.isPending} onClick={() => save.mutate()}><Save data-icon="inline-start" />Simpan Pajak</Button></div></>}
    <p className="mt-2 text-xs text-muted-foreground">PTKP source: marital_status · tarif aktif dibaca per akhir periode payroll.</p>
  </div>;
}

function TaxTerEditor({ canManage }: { canManage: boolean }) {
  const client = useQueryClient();
  const [rows, setRows] = useState<TerRow[]>([]);
  const query = useQuery({ queryKey: ["payroll-tax-ter-rates"], queryFn: () => apiFetchEnvelope<TaxTerRate[]>("payroll/tax-ter-rates") });

  useEffect(() => {
    if (query.data?.data) setRows(query.data.data.map((item) => ({ category: item.category, income_from: item.income_from, income_to: item.income_to ?? null, rate_percent: item.rate_percent, is_active: item.is_active })));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => apiFetch<TaxTerRate[]>("payroll/tax-ter-rates", { method: "PUT", body: JSON.stringify({ rates: rows } satisfies UpdateTaxTerRatesRequest) }),
    onSuccess: async () => { toast.success("Tarif TER diperbarui"); await client.invalidateQueries({ queryKey: ["payroll-tax-ter-rates"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} retry={() => void query.refetch()} />;

  return <div className="rounded-xl border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">TER Rates</h3><p className="text-xs text-muted-foreground">PUT /payroll/tax-ter-rates · seluruh baris diganti saat disimpan.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!canManage} onClick={() => setRows((current) => [...current, { category: "A", income_from: 0, income_to: null, rate_percent: 0, is_active: true }])}><Plus data-icon="inline-start" />Tambah</Button><Button size="sm" disabled={!canManage || save.isPending || rows.length === 0} onClick={() => save.mutate()}><Save data-icon="inline-start" />Simpan TER</Button></div></div>
    {query.isLoading ? <LoadingState label="Memuat tarif TER" /> : rows.length === 0 ? <p className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Belum ada tarif TER. Tambahkan minimal satu baris sebelum menyimpan.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 pr-3 font-medium">Kategori</th><th className="py-2 pr-3 font-medium">Penghasilan dari</th><th className="py-2 pr-3 font-medium">Sampai</th><th className="py-2 pr-3 font-medium">Rate %</th><th className="py-2 pr-3 font-medium">Aktif</th><th className="py-2 font-medium" /></tr></thead><tbody className="divide-y">{rows.map((row, index) => <tr key={index}><td className="py-2 pr-3"><select aria-label="Kategori TER" className="h-9 rounded-lg border bg-background px-2 text-sm" value={row.category} onChange={(event) => updateRow(setRows, index, { category: event.target.value as TerRow["category"] })}><option value="A">A</option><option value="B">B</option><option value="C">C</option></select></td><td className="py-2 pr-3"><Input aria-label="Penghasilan dari" type="number" min="0" step="1000" value={row.income_from} onChange={(event) => updateRow(setRows, index, { income_from: Number(event.target.value) })} /></td><td className="py-2 pr-3"><Input aria-label="Penghasilan sampai" type="number" min="0" step="1000" value={row.income_to ?? ""} placeholder="Tak terbatas" onChange={(event) => updateRow(setRows, index, { income_to: event.target.value === "" ? null : Number(event.target.value) })} /></td><td className="py-2 pr-3"><Input aria-label="Rate TER" type="number" min="0" max="100" step="0.01" value={row.rate_percent} onChange={(event) => updateRow(setRows, index, { rate_percent: Number(event.target.value) })} /></td><td className="py-2 pr-3"><input aria-label="Aktif" type="checkbox" className="size-4" checked={row.is_active} onChange={(event) => updateRow(setRows, index, { is_active: event.target.checked })} /></td><td className="py-2"><Button size="sm" variant="ghost" aria-label="Hapus baris TER" onClick={() => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></Button></td></tr>)}</tbody></table></div>}
  </div>;
}

function TaxBracketEditor({ canManage }: { canManage: boolean }) {
  const client = useQueryClient();
  const [rows, setRows] = useState<BracketRow[]>([]);
  const query = useQuery({ queryKey: ["payroll-tax-brackets"], queryFn: () => apiFetchEnvelope<TaxBracket[]>("payroll/tax-brackets") });

  useEffect(() => {
    if (query.data?.data) setRows(query.data.data.map((item) => ({ pkp_from: item.pkp_from, pkp_to: item.pkp_to ?? null, rate_percent: item.rate_percent, is_active: item.is_active })));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => apiFetch<TaxBracket[]>("payroll/tax-brackets", { method: "PUT", body: JSON.stringify({ brackets: rows } satisfies UpdateTaxBracketsRequest) }),
    onSuccess: async () => { toast.success("Braket progresif diperbarui"); await client.invalidateQueries({ queryKey: ["payroll-tax-brackets"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} retry={() => void query.refetch()} />;

  return <div className="rounded-xl border p-4">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">Braket Progresif</h3><p className="text-xs text-muted-foreground">PUT /payroll/tax-brackets · seluruh baris diganti saat disimpan.</p></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!canManage} onClick={() => setRows((current) => [...current, { pkp_from: 0, pkp_to: null, rate_percent: 0, is_active: true }])}><Plus data-icon="inline-start" />Tambah</Button><Button size="sm" disabled={!canManage || save.isPending || rows.length === 0} onClick={() => save.mutate()}><Save data-icon="inline-start" />Simpan Braket</Button></div></div>
    {query.isLoading ? <LoadingState label="Memuat braket pajak" /> : rows.length === 0 ? <p className="mt-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Belum ada braket progresif. Tambahkan minimal satu baris sebelum menyimpan.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 pr-3 font-medium">PKP dari</th><th className="py-2 pr-3 font-medium">PKP sampai</th><th className="py-2 pr-3 font-medium">Rate %</th><th className="py-2 pr-3 font-medium">Aktif</th><th className="py-2 font-medium" /></tr></thead><tbody className="divide-y">{rows.map((row, index) => <tr key={index}><td className="py-2 pr-3"><Input aria-label="PKP dari" type="number" min="0" step="1000" value={row.pkp_from} onChange={(event) => updateRow(setRows, index, { pkp_from: Number(event.target.value) })} /></td><td className="py-2 pr-3"><Input aria-label="PKP sampai" type="number" min="0" step="1000" value={row.pkp_to ?? ""} placeholder="Tak terbatas" onChange={(event) => updateRow(setRows, index, { pkp_to: event.target.value === "" ? null : Number(event.target.value) })} /></td><td className="py-2 pr-3"><Input aria-label="Rate braket" type="number" min="0" max="100" step="0.01" value={row.rate_percent} onChange={(event) => updateRow(setRows, index, { rate_percent: Number(event.target.value) })} /></td><td className="py-2 pr-3"><input aria-label="Aktif" type="checkbox" className="size-4" checked={row.is_active} onChange={(event) => updateRow(setRows, index, { is_active: event.target.checked })} /></td><td className="py-2"><Button size="sm" variant="ghost" aria-label="Hapus braket" onClick={() => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></Button></td></tr>)}</tbody></table></div>}
  </div>;
}

function OvertimeSection({ canManage }: { canManage: boolean }) {
  const client = useQueryClient();
  const [rows, setRows] = useState<OvertimeRow[]>([]);
  const query = useQuery({ queryKey: ["payroll-overtime-rules"], queryFn: () => apiFetchEnvelope<OvertimeRule[]>("payroll/overtime-rules") });

  useEffect(() => {
    if (query.data?.data) setRows(query.data.data.map((item) => ({ day_type: item.day_type, hour_from: item.hour_from, hour_to: item.hour_to, multiplier: item.multiplier, is_active: item.is_active })));
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => apiFetch<OvertimeRule[]>("payroll/overtime-rules", { method: "PUT", body: JSON.stringify({ rules: rows } satisfies UpdateOvertimeRulesRequest) }),
    onSuccess: async () => { toast.success("Aturan lembur diperbarui"); await client.invalidateQueries({ queryKey: ["payroll-overtime-rules"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (query.isLoading) return <LoadingState label="Memuat aturan lembur" />;
  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} retry={() => void query.refetch()} />;

  return <Card>
    <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Overtime Rules</CardTitle><CardDescription>PUT /payroll/overtime-rules · seluruh aturan diganti; minimal satu baris.</CardDescription></div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!canManage} onClick={() => setRows((current) => [...current, { day_type: "workday", hour_from: 1, hour_to: 2, multiplier: 1.5, is_active: true }])}><Plus data-icon="inline-start" />Tambah Aturan</Button><Button size="sm" disabled={!canManage || save.isPending || rows.length === 0} onClick={() => save.mutate()}><Save data-icon="inline-start" />Simpan Aturan</Button></div></CardHeader>
    <CardContent>
      {rows.length === 0 ? <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">Belum ada aturan lembur. Tambahkan minimal satu baris sebelum menyimpan.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 pr-3 font-medium">Tipe hari</th><th className="py-2 pr-3 font-medium">Dari jam</th><th className="py-2 pr-3 font-medium">Sampai jam</th><th className="py-2 pr-3 font-medium">Multiplier</th><th className="py-2 pr-3 font-medium">Status</th><th className="py-2 font-medium" /></tr></thead><tbody className="divide-y">{rows.map((row, index) => <tr key={index}><td className="py-2 pr-3"><select aria-label="Tipe hari" className="h-9 rounded-lg border bg-background px-2 text-sm" value={row.day_type} onChange={(event) => updateRow(setRows, index, { day_type: event.target.value as OvertimeRow["day_type"] })}><option value="workday">Hari kerja</option><option value="holiday">Hari libur</option></select></td><td className="py-2 pr-3"><Input aria-label="Dari jam" type="number" min="0" max="24" step="0.5" value={row.hour_from} onChange={(event) => updateRow(setRows, index, { hour_from: Number(event.target.value) })} /></td><td className="py-2 pr-3"><Input aria-label="Sampai jam" type="number" min="0" max="24" step="0.5" value={row.hour_to} onChange={(event) => updateRow(setRows, index, { hour_to: Number(event.target.value) })} /></td><td className="py-2 pr-3"><Input aria-label="Multiplier" type="number" min="0" max="10" step="0.1" value={row.multiplier} onChange={(event) => updateRow(setRows, index, { multiplier: Number(event.target.value) })} /></td><td className="py-2 pr-3"><label className="flex items-center gap-2 text-xs"><input type="checkbox" className="size-4" checked={row.is_active} onChange={(event) => updateRow(setRows, index, { is_active: event.target.checked })} /><StatusBadge status={row.is_active ? "approved" : "cancelled"} /></label></td><td className="py-2"><Button size="sm" variant="ghost" aria-label="Hapus aturan lembur" onClick={() => setRows((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Trash2 /></Button></td></tr>)}</tbody></table></div>}
    </CardContent>
  </Card>;
}

function updateRow<T>(setter: React.Dispatch<React.SetStateAction<T[]>>, index: number, patch: Partial<T>) {
  setter((current) => current.map((row, itemIndex) => itemIndex === index ? { ...row, ...patch } : row));
}
