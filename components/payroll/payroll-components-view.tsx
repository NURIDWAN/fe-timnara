"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { apiFetch, apiFetchEnvelope, getPagination } from "@/lib/api/client";
import type { EmployeePayrollProfile, EmployeeSalary, SalaryComponent, SalaryHistory, StoreEmployeeAllowanceRequest, StoreEmployeeDeductionRequest, StoreSalaryComponentRequest } from "@/lib/api/types";
import { hasPermission } from "@/lib/permissions";
import { EmployeeSelect, Field, PayrollShell, formatDate, formatRupiah, useEmployeeList } from "@/components/payroll/payroll-shared";

type ComponentForm = StoreSalaryComponentRequest & { id?: string };

const emptyComponent: ComponentForm = { code: "", name: "", category: "allowance", calculation_type: "fixed", default_amount: null, percentage: null, percentage_base: "gross", taxable: false, bpjs_base: false, is_prorated: false, is_active: true, sort_order: 10 };
const categories = ["basic", "allowance", "deduction", "employer_contribution", "tax", "loan", "adjustment"] as const;
const calculations = ["fixed", "per_day", "per_hour", "percentage", "formula"] as const;
const categoryLabel: Record<string, string> = { basic: "Basic", allowance: "Tunjangan", deduction: "Potongan", employer_contribution: "Kontribusi perusahaan", tax: "Pajak", loan: "Pinjaman", adjustment: "Penyesuaian" };

export function PayrollComponentsView({ permissions }: { permissions: string[] }) {
  if (!hasPermission(permissions, "payroll.view")) return <UnauthorizedState />;
  return <PayrollShell permissions={permissions} current="/admin/payroll/components" title="Komponen & Gaji" description="Master komponen gaji, gaji pokok karyawan, tunjangan, potongan, dan histori perubahan."><ComponentsContent permissions={permissions} /></PayrollShell>;
}

function ComponentsContent({ permissions }: { permissions: string[] }) {
  const canManage = hasPermission(permissions, "payroll.manage");
  return <div className="flex flex-col gap-4"><ComponentSection canManage={canManage} /><SalarySection permissions={permissions} canManage={canManage} /></div>;
}

function ComponentSection({ canManage }: { canManage: boolean }) {
  const client = useQueryClient();
  const [form, setForm] = useState<ComponentForm>(emptyComponent);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const query = useQuery({ queryKey: ["payroll-components", "all"], queryFn: () => apiFetchEnvelope<SalaryComponent[]>("payroll/components?per_page=100&page=1") });

  const save = useMutation({
    mutationFn: () => form.id
      ? apiFetch<SalaryComponent>(`payroll/components/${form.id}`, { method: "PATCH", body: JSON.stringify(payload()) })
      : apiFetch<SalaryComponent>("payroll/components", { method: "POST", body: JSON.stringify(payload()) }),
    onSuccess: async () => { toast.success(form.id ? "Komponen gaji diperbarui" : "Komponen gaji dibuat"); setForm(emptyComponent); setFieldErrors({}); await client.invalidateQueries({ queryKey: ["payroll-components"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<null>(`payroll/components/${id}`, { method: "DELETE" }),
    onSuccess: async () => { toast.success("Komponen gaji dihapus"); await client.invalidateQueries({ queryKey: ["payroll-components"] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  function payload(): StoreSalaryComponentRequest {
    const base: StoreSalaryComponentRequest = {
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      category: form.category,
      calculation_type: form.calculation_type,
      default_amount: form.default_amount ?? null,
      percentage: form.percentage ?? null,
      percentage_base: form.percentage_base ?? "gross",
      taxable: form.taxable ?? false,
      bpjs_base: form.bpjs_base ?? false,
      is_prorated: form.is_prorated ?? false,
      is_active: form.is_active ?? true,
      sort_order: form.sort_order ?? 0,
    };
    return base;
  }

  function submit() {
    const errors: Record<string, string> = {};
    if (!/^[A-Za-z0-9_-]{1,20}$/.test(form.code)) errors.code = "Kode 1–20 karakter, hanya huruf, angka, garis bawah, atau tanda hubung.";
    if (form.name.trim().length < 2) errors.name = "Nama minimal 2 karakter.";
    if (form.calculation_type === "percentage" && !form.percentage_base) errors.percentage_base = "Dasar persentase wajib diisi.";
    setFieldErrors(errors);
    if (Object.keys(errors).length === 0) save.mutate();
  }

  function edit(component: SalaryComponent) {
    setForm({ id: component.id, code: component.code, name: component.name, category: component.category, calculation_type: component.calculation_type, default_amount: component.default_amount ?? null, percentage: component.percentage ?? null, percentage_base: component.percentage_base, taxable: component.taxable, bpjs_base: component.bpjs_base, is_prorated: component.is_prorated, is_active: component.is_active, sort_order: component.sort_order });
    setFieldErrors({});
  }

  if (query.isLoading) return <LoadingState label="Memuat komponen gaji" />;
  if (query.isError) return <ErrorState message={getErrorMessage(query.error)} retry={() => void query.refetch()} />;
  const components = query.data?.data ?? [];

  return <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
    <Card className="h-fit">
      <CardHeader><CardTitle>{form.id ? "Edit Komponen" : "Tambah Komponen"}</CardTitle><CardDescription>Komponen berlaku tenant-wide; nilai karyawan diatur terpisah.</CardDescription></CardHeader>
      <CardContent><form className="flex flex-col gap-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <div className="grid grid-cols-2 gap-3"><Field label="Code *" error={fieldErrors.code}><Input aria-invalid={Boolean(fieldErrors.code)} maxLength={20} value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="TJ-TRANSPORT" /></Field><Field label="Name *" error={fieldErrors.name}><Input aria-invalid={Boolean(fieldErrors.name)} maxLength={100} value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Tunjangan Transport" /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Kategori *"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as ComponentForm["category"] }))}>{categories.map((category) => <option key={category} value={category}>{categoryLabel[category]}</option>)}</select></Field><Field label="Calculation *"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.calculation_type} onChange={(event) => setForm((current) => ({ ...current, calculation_type: event.target.value as ComponentForm["calculation_type"] }))}>{calculations.map((type) => <option key={type} value={type}>{type}</option>)}</select></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Default amount"><Input type="number" min="0" step="1000" value={form.default_amount ?? ""} placeholder="0" onChange={(event) => setForm((current) => ({ ...current, default_amount: event.target.value === "" ? null : Number(event.target.value) }))} /></Field><Field label="Percentage"><Input type="number" min="0" max="100" step="0.01" value={form.percentage ?? ""} placeholder="Tanpa persentase" onChange={(event) => setForm((current) => ({ ...current, percentage: event.target.value === "" ? null : Number(event.target.value) }))} /></Field></div>
        <Field label="Percentage base" error={fieldErrors.percentage_base}><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={form.percentage_base ?? "gross"} onChange={(event) => setForm((current) => ({ ...current, percentage_base: event.target.value as ComponentForm["percentage_base"] }))}><option value="basic_salary">basic_salary</option><option value="gross">gross</option><option value="bruto_tax">bruto_tax</option></select></Field>
        <fieldset className="rounded-lg border p-3"><legend className="px-1 text-xs font-medium text-muted-foreground">Flags komponen</legend><div className="grid gap-2 text-sm"><label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={form.taxable ?? false} onChange={(event) => setForm((current) => ({ ...current, taxable: event.target.checked }))} />Taxable — masuk bruto PPh 21</label><label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={form.bpjs_base ?? false} onChange={(event) => setForm((current) => ({ ...current, bpjs_base: event.target.checked }))} />BPJS base — masuk dasar BPJS</label><label className="flex items-center gap-2"><input type="checkbox" className="size-4" checked={form.is_prorated ?? false} onChange={(event) => setForm((current) => ({ ...current, is_prorated: event.target.checked }))} />Prorated — proporsional periode parsial</label></div></fieldset>
        <div className="grid grid-cols-2 gap-3"><Field label="Sort order"><Input type="number" min="0" max="1000" value={form.sort_order ?? 0} onChange={(event) => setForm((current) => ({ ...current, sort_order: Number(event.target.value) }))} /></Field><label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" className="size-4" checked={form.is_active ?? true} onChange={(event) => setForm((current) => ({ ...current, is_active: event.target.checked }))} />Aktif</label></div>
        <div className="flex gap-2"><Button type="submit" disabled={!canManage || save.isPending}><Save data-icon="inline-start" />{form.id ? "Simpan Perubahan" : "Tambah Komponen"}</Button>{form.id ? <Button type="button" variant="outline" onClick={() => { setForm(emptyComponent); setFieldErrors({}); }}>Batal</Button> : null}</div>
      </form></CardContent>
    </Card>

    <Card><CardHeader><CardTitle>Daftar Komponen</CardTitle><CardDescription>{getPagination(query.data?.meta ?? {})?.total ?? components.length} komponen tenant-scoped.</CardDescription></CardHeader><CardContent>{components.length === 0 ? <EmptyState title="Belum ada komponen gaji" description="Tambahkan komponen seperti gaji pokok, tunjangan, atau potongan." /> : <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-4 font-medium">Code</th><th className="py-3 pr-4 font-medium">Nama</th><th className="py-3 pr-4 font-medium">Kategori</th><th className="py-3 pr-4 font-medium">Formula</th><th className="py-3 pr-4 font-medium">Status</th><th className="py-3 font-medium">Aksi</th></tr></thead><tbody className="divide-y">{components.map((component) => <tr key={component.id}><td className="py-3 pr-4 font-medium">{component.code}</td><td className="py-3 pr-4">{component.name}</td><td className="py-3 pr-4 text-muted-foreground">{categoryLabel[component.category] ?? component.category}</td><td className="py-3 pr-4 text-muted-foreground">{component.calculation_type}{component.percentage !== null ? ` · ${component.percentage}%` : component.default_amount ? ` · ${formatRupiah(component.default_amount)}` : ""}</td><td className="py-3 pr-4"><Badge variant={component.is_active ? "secondary" : "outline"}>{component.is_active ? "Aktif" : "Nonaktif"}</Badge></td><td className="py-3"><div className="flex gap-1.5">{canManage ? <Button size="sm" variant="ghost" aria-label={`Edit ${component.code}`} onClick={() => edit(component)}><Pencil /></Button> : null}{canManage ? <Button size="sm" variant="ghost" aria-label={`Hapus ${component.code}`} onClick={() => { if (window.confirm(`Hapus komponen ${component.code}?`)) remove.mutate(component.id); }}><Trash2 /></Button> : null}</div></td></tr>)}</tbody></table></div>}</CardContent></Card>
  </div>;
}

function SalarySection({ permissions, canManage }: { permissions: string[]; canManage: boolean }) {
  const client = useQueryClient();
  const canViewEmployees = hasPermission(permissions, "employee.view");
  const [search, setSearch] = useState("");
  const [wageType, setWageType] = useState("");
  const [active, setActive] = useState("true");
  const [employeeId, setEmployeeId] = useState("");
  const params = new URLSearchParams({ per_page: "50", page: "1" });
  if (search.trim()) params.set("q", search.trim());
  if (wageType) params.set("wage_type", wageType);
  if (active) params.set("active", active);

  const employees = useEmployeeList(canViewEmployees);
  const salaries = useQuery({ queryKey: ["payroll-salaries", search, wageType, active], queryFn: () => apiFetchEnvelope<EmployeeSalary[]>(`payroll/salaries?${params}`) });
  const profile = useQuery({ queryKey: ["payroll-profile", employeeId], queryFn: () => apiFetchEnvelope<EmployeePayrollProfile>(`payroll/salaries/${employeeId}`), enabled: Boolean(employeeId) });
  const history = useQuery({ queryKey: ["payroll-salary-history", employeeId], queryFn: () => apiFetchEnvelope<SalaryHistory[]>(`payroll/salaries/${employeeId}/history?per_page=50`), enabled: Boolean(employeeId) });
  const components = useQuery({ queryKey: ["payroll-components", "all"], queryFn: () => apiFetchEnvelope<SalaryComponent[]>("payroll/components?per_page=100&page=1") });

  const selected = profile.data?.data;
  const [salaryForm, setSalaryForm] = useState({ basic_salary: 0, wage_type: "monthly" as EmployeeSalary["wage_type"], daily_rate: "", hourly_rate: "", effective_from: new Date().toISOString().slice(0, 10), decision_number: "", reason: "" });

  useEffect(() => {
    if (!selected) return;
    const salary = selected.salary;
    setSalaryForm({ basic_salary: salary?.basic_salary ?? 0, wage_type: salary?.wage_type ?? "monthly", daily_rate: salary?.daily_rate ? String(salary.daily_rate) : "", hourly_rate: salary?.hourly_rate ? String(salary.hourly_rate) : "", effective_from: salary?.effective_from ?? new Date().toISOString().slice(0, 10), decision_number: salary?.decision_number ?? "", reason: "" });
  }, [selected]);

  const saveSalary = useMutation({
    mutationFn: () => {
      const body = { basic_salary: salaryForm.basic_salary, wage_type: salaryForm.wage_type, daily_rate: salaryForm.daily_rate ? Number(salaryForm.daily_rate) : null, hourly_rate: salaryForm.hourly_rate ? Number(salaryForm.hourly_rate) : null, effective_from: salaryForm.effective_from, decision_number: salaryForm.decision_number || null, reason: salaryForm.reason || null };
      return selected?.salary
        ? apiFetch<EmployeeSalary>(`payroll/salaries/${employeeId}`, { method: "PUT", body: JSON.stringify(body) })
        : apiFetch<EmployeeSalary>("payroll/salaries", { method: "POST", body: JSON.stringify({ ...body, employee_id: employeeId }) });
    },
    onSuccess: async () => { toast.success("Gaji karyawan disimpan sebagai record efektif baru"); await client.invalidateQueries({ queryKey: ["payroll-profile", employeeId] }); await client.invalidateQueries({ queryKey: ["payroll-salaries"] }); await client.invalidateQueries({ queryKey: ["payroll-salary-history", employeeId] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });

  if (salaries.isLoading) return <LoadingState label="Memuat gaji karyawan" />;
  if (salaries.isError) return <ErrorState message={getErrorMessage(salaries.error)} retry={() => void salaries.refetch()} />;
  const rows = salaries.data?.data ?? [];

  return <div className="flex flex-col gap-4">
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Gaji Pokok Karyawan</CardTitle><CardDescription>Perubahan disimpan sebagai record histori baru berdasarkan effective_from.</CardDescription></div><div className="flex flex-wrap gap-2"><Input aria-label="Cari karyawan" className="w-52" placeholder="Cari nama / nomor induk" value={search} onChange={(event) => setSearch(event.target.value)} /><select aria-label="Tipe upah" className="h-9 rounded-lg border bg-background px-2 text-sm" value={wageType} onChange={(event) => setWageType(event.target.value)}><option value="">Semua tipe</option><option value="monthly">Bulanan</option><option value="daily">Harian</option><option value="hourly">Per jam</option></select><select aria-label="Status aktif" className="h-9 rounded-lg border bg-background px-2 text-sm" value={active} onChange={(event) => setActive(event.target.value)}><option value="true">Aktif</option><option value="">Semua</option><option value="false">Nonaktif</option></select></div></CardHeader>
      <CardContent>
        {rows.length === 0 ? <EmptyState title="Belum ada data gaji" description="Tetapkan gaji pokok karyawan untuk memulai perhitungan payroll." /> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-3 pr-4 font-medium">Karyawan</th><th className="py-3 pr-4 text-right font-medium">Gaji pokok</th><th className="py-3 pr-4 font-medium">Tipe upah</th><th className="py-3 pr-4 font-medium">Efektif</th><th className="py-3 pr-4 font-medium">SK</th><th className="py-3 font-medium">Status</th></tr></thead><tbody className="divide-y">{rows.map((salary) => <tr key={salary.id} className={selected?.employee.id === salary.employee_id ? "bg-accent/50" : undefined}><td className="py-3 pr-4"><button type="button" className="text-left font-medium hover:text-primary" onClick={() => setEmployeeId(salary.employee_id)}>{salary.employee?.full_name ?? salary.employee_id}<span className="block text-xs font-normal text-muted-foreground">{salary.employee?.employee_number}</span></button></td><td className="py-3 pr-4 text-right font-medium">{formatRupiah(salary.basic_salary)}</td><td className="py-3 pr-4 text-muted-foreground">{salary.wage_type}</td><td className="py-3 pr-4">{formatDate(salary.effective_from)}{salary.effective_to ? ` – ${formatDate(salary.effective_to)}` : ""}</td><td className="py-3 pr-4 text-muted-foreground">{salary.decision_number ?? "—"}</td><td className="py-3"><Badge variant={salary.is_active ? "secondary" : "outline"}>{salary.is_active ? "Aktif" : "Nonaktif"}</Badge></td></tr>)}</tbody></table></div>}
      </CardContent>
    </Card>

    <Card>
      <CardHeader><CardTitle>Profil Payroll Karyawan</CardTitle><CardDescription>Pilih karyawan untuk mengatur gaji pokok, tunjangan, potongan, dan melihat histori.</CardDescription></CardHeader>
      <CardContent className="flex flex-col gap-5">
        <Field label="Karyawan">{canViewEmployees && (employees.data?.data?.length ?? 0) > 0 ? <EmployeeSelect employees={employees.data?.data ?? []} value={employeeId} onChange={setEmployeeId} /> : <Input value={employeeId} onChange={(event) => setEmployeeId(event.target.value)} placeholder="ULID karyawan" />}</Field>
        {!employeeId ? <p className="text-sm text-muted-foreground">Belum ada karyawan dipilih.</p> : profile.isLoading ? <LoadingState label="Memuat profil payroll" /> : profile.isError || !selected ? <ErrorState message={getErrorMessage(profile.error)} retry={() => void profile.refetch()} /> : <div className="flex flex-col gap-5">
          <div className="rounded-xl border p-4"><h3 className="font-semibold">{selected.employee.full_name}</h3><p className="text-xs text-muted-foreground">{selected.employee.employee_number} · {selected.salary ? `Gaji aktif ${formatRupiah(selected.salary.basic_salary)}` : "Belum ada gaji aktif"}</p></div>
          <div className="grid gap-4 lg:grid-cols-2">
            <form className="rounded-xl border p-4" onSubmit={(event) => { event.preventDefault(); saveSalary.mutate(); }}>
              <h3 className="font-semibold">Gaji Pokok</h3>
              <p className="mb-3 text-xs text-muted-foreground">{selected.salary ? "PUT /payroll/salaries/{employee} · record baru menggantikan yang aktif." : "POST /payroll/salaries · record pertama karyawan."}</p>
              <div className="flex flex-col gap-3">
                <Field label="Basic salary *"><Input required type="number" min="0" step="1000" value={salaryForm.basic_salary} onChange={(event) => setSalaryForm((current) => ({ ...current, basic_salary: Number(event.target.value) }))} /></Field>
                <div className="grid grid-cols-2 gap-3"><Field label="Wage type *"><select className="h-10 w-full rounded-lg border bg-background px-3 text-sm" value={salaryForm.wage_type} onChange={(event) => setSalaryForm((current) => ({ ...current, wage_type: event.target.value as EmployeeSalary["wage_type"] }))}><option value="monthly">Bulanan</option><option value="daily">Harian</option><option value="hourly">Per jam</option></select></Field><Field label="Effective from *"><Input required type="date" value={salaryForm.effective_from} onChange={(event) => setSalaryForm((current) => ({ ...current, effective_from: event.target.value }))} /></Field></div>
                <div className="grid grid-cols-2 gap-3"><Field label="Daily rate"><Input type="number" min="0" step="1000" value={salaryForm.daily_rate} onChange={(event) => setSalaryForm((current) => ({ ...current, daily_rate: event.target.value }))} /></Field><Field label="Hourly rate"><Input type="number" min="0" step="1000" value={salaryForm.hourly_rate} onChange={(event) => setSalaryForm((current) => ({ ...current, hourly_rate: event.target.value }))} /></Field></div>
                <Field label="Decision number"><Input maxLength={100} value={salaryForm.decision_number} onChange={(event) => setSalaryForm((current) => ({ ...current, decision_number: event.target.value }))} placeholder="SK-2026-001" /></Field>
                <Field label="Reason" hint="Minimal 5 karakter bila diisi."><Input maxLength={300} value={salaryForm.reason} onChange={(event) => setSalaryForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Promosi / penyesuaian" /></Field>
                <Button type="submit" disabled={!canManage || saveSalary.isPending}>Simpan Gaji</Button>
              </div>
            </form>
            <div className="flex flex-col gap-4">
              <AllowanceEditor employeeId={employeeId} components={components.data?.data ?? []} canManage={canManage} profile={selected} />
              <DeductionEditor employeeId={employeeId} components={components.data?.data ?? []} canManage={canManage} profile={selected} />
            </div>
          </div>
          <div className="rounded-xl border p-4"><h3 className="font-semibold">Histori Gaji</h3>{history.isError ? <p className="mt-2 text-sm text-destructive">{getErrorMessage(history.error)}</p> : (history.data?.data ?? []).length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Belum ada histori.</p> : <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[520px] text-left text-sm"><thead className="border-b text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="py-2 pr-4 font-medium">Efektif</th><th className="py-2 pr-4 text-right font-medium">Lama</th><th className="py-2 pr-4 text-right font-medium">Baru</th><th className="py-2 font-medium">Alasan</th></tr></thead><tbody className="divide-y">{(history.data?.data ?? []).map((item) => <tr key={item.id}><td className="py-2 pr-4">{formatDate(item.effective_from)}</td><td className="py-2 pr-4 text-right text-muted-foreground">{item.old_amount === null ? "—" : formatRupiah(item.old_amount)}</td><td className="py-2 pr-4 text-right font-medium">{formatRupiah(item.new_amount)}</td><td className="py-2 text-muted-foreground">{item.reason ?? "—"}</td></tr>)}</tbody></table></div>}</div>
        </div>}
      </CardContent>
    </Card>
  </div>;
}

function AllowanceEditor({ employeeId, components, canManage, profile }: { employeeId: string; components: SalaryComponent[]; canManage: boolean; profile: EmployeePayrollProfile }) {
  const client = useQueryClient();
  const [componentId, setComponentId] = useState("");
  const [amount, setAmount] = useState("");
  const [calculation, setCalculation] = useState<StoreEmployeeAllowanceRequest["calculation_type"]>("fixed");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState("");
  const options = components.filter((component) => ["allowance", "basic", "employer_contribution"].includes(component.category) && component.is_active);
  const add = useMutation({
    mutationFn: () => apiFetch<unknown>(`payroll/salaries/${employeeId}/allowances`, { method: "POST", body: JSON.stringify({ salary_component_id: componentId, amount: Number(amount), calculation_type: calculation, effective_from: effectiveFrom, effective_to: effectiveTo || null, is_active: true } satisfies StoreEmployeeAllowanceRequest) }),
    onSuccess: async () => { toast.success("Tunjangan karyawan ditambahkan"); setComponentId(""); setAmount(""); await client.invalidateQueries({ queryKey: ["payroll-profile", employeeId] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => apiFetch<null>(`payroll/salaries/${employeeId}/allowances/${id}`, { method: "DELETE" }),
    onSuccess: async () => { toast.success("Tunjangan dihapus"); await client.invalidateQueries({ queryKey: ["payroll-profile", employeeId] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return <div className="rounded-xl border p-4"><h3 className="font-semibold">Tunjangan</h3><div className="mt-2 flex flex-col divide-y">{profile.allowances.length === 0 ? <p className="py-2 text-sm text-muted-foreground">Belum ada tunjangan.</p> : profile.allowances.map((item) => <div key={item.id} className="flex items-center gap-2 py-2 text-sm"><div className="min-w-0 flex-1"><p className="font-medium">{item.component?.name ?? item.salary_component_id}</p><p className="text-xs text-muted-foreground">{formatRupiah(item.amount)} · {item.calculation_type} · {formatDate(item.effective_from)}{item.effective_to ? ` – ${formatDate(item.effective_to)}` : ""}</p></div><Badge variant={item.is_active ? "secondary" : "outline"}>{item.is_active ? "Aktif" : "Nonaktif"}</Badge>{canManage ? <Button size="sm" variant="ghost" aria-label="Hapus tunjangan" onClick={() => remove.mutate(item.id)}><Trash2 /></Button> : null}</div>)}</div>{canManage ? <form className="mt-3 grid gap-2 border-t pt-3" onSubmit={(event) => { event.preventDefault(); add.mutate(); }}><select aria-label="Komponen tunjangan" required className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={componentId} onChange={(event) => setComponentId(event.target.value)}><option value="">Pilih komponen</option>{options.map((component) => <option key={component.id} value={component.id}>{component.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><Input aria-label="Nominal tunjangan" required type="number" min="0" step="1000" placeholder="Nominal" value={amount} onChange={(event) => setAmount(event.target.value)} /><select aria-label="Tipe perhitungan tunjangan" className="h-9 rounded-lg border bg-background px-2 text-sm" value={calculation} onChange={(event) => setCalculation(event.target.value as StoreEmployeeAllowanceRequest["calculation_type"])}>{["fixed", "per_day", "per_hour", "percentage", "formula"].map((type) => <option key={type} value={type}>{type}</option>)}</select><Input aria-label="Efektif dari" required type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /><Input aria-label="Efektif sampai" type="date" min={effectiveFrom} value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} /></div><Button size="sm" type="submit" disabled={add.isPending || !componentId || !amount}><Plus data-icon="inline-start" />Tambah Tunjangan</Button></form> : null}</div>;
}

function DeductionEditor({ employeeId, components, canManage, profile }: { employeeId: string; components: SalaryComponent[]; canManage: boolean; profile: EmployeePayrollProfile }) {
  const client = useQueryClient();
  const [componentId, setComponentId] = useState("");
  const [amount, setAmount] = useState("");
  const [calculation, setCalculation] = useState<StoreEmployeeDeductionRequest["calculation_type"]>("fixed");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [effectiveTo, setEffectiveTo] = useState("");
  const options = components.filter((component) => ["deduction", "loan", "tax"].includes(component.category) && component.is_active);
  const add = useMutation({
    mutationFn: () => apiFetch<unknown>(`payroll/salaries/${employeeId}/deductions`, { method: "POST", body: JSON.stringify({ salary_component_id: componentId, amount: Number(amount), calculation_type: calculation, effective_from: effectiveFrom, effective_to: effectiveTo || null, is_active: true } satisfies StoreEmployeeDeductionRequest) }),
    onSuccess: async () => { toast.success("Potongan karyawan ditambahkan"); setComponentId(""); setAmount(""); await client.invalidateQueries({ queryKey: ["payroll-profile", employeeId] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  const setActive = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => apiFetch<unknown>(`payroll/salaries/${employeeId}/deductions/${id}`, { method: "PATCH", body: JSON.stringify({ is_active }) }),
    onSuccess: async (_, variables) => { toast.success(variables.is_active ? "Potongan diaktifkan" : "Potongan dinonaktifkan; histori tetap tersimpan"); await client.invalidateQueries({ queryKey: ["payroll-profile", employeeId] }); },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
  return <div className="rounded-xl border p-4"><h3 className="font-semibold">Potongan</h3><p className="text-xs text-muted-foreground">Nonaktifkan untuk menghentikan pemakaian pada perhitungan berikutnya; histori tetap dipertahankan.</p><div className="mt-2 flex flex-col divide-y">{profile.deductions.length === 0 ? <p className="py-2 text-sm text-muted-foreground">Belum ada potongan.</p> : profile.deductions.map((item) => <div key={item.id} className="flex items-center gap-2 py-2 text-sm"><div className="min-w-0 flex-1"><p className="font-medium">{item.component?.name ?? item.salary_component_id}</p><p className="text-xs text-muted-foreground">{formatRupiah(item.amount)} · {item.calculation_type} · {formatDate(item.effective_from)}</p></div><Badge variant={item.is_active ? "secondary" : "outline"}>{item.is_active ? "Aktif" : "Nonaktif"}</Badge>{canManage ? <Button size="sm" variant="outline" disabled={setActive.isPending} onClick={() => setActive.mutate({ id: item.id, is_active: !item.is_active })}>{item.is_active ? "Nonaktifkan" : "Aktifkan"}</Button> : null}</div>)}</div>{canManage ? <form className="mt-3 grid gap-2 border-t pt-3" onSubmit={(event) => { event.preventDefault(); add.mutate(); }}><select aria-label="Komponen potongan" required className="h-9 w-full rounded-lg border bg-background px-2 text-sm" value={componentId} onChange={(event) => setComponentId(event.target.value)}><option value="">Pilih komponen</option>{options.map((component) => <option key={component.id} value={component.id}>{component.name}</option>)}</select><div className="grid grid-cols-2 gap-2"><Input aria-label="Nominal potongan" required type="number" min="0" step="1000" placeholder="Nominal" value={amount} onChange={(event) => setAmount(event.target.value)} /><select aria-label="Tipe perhitungan potongan" className="h-9 rounded-lg border bg-background px-2 text-sm" value={calculation} onChange={(event) => setCalculation(event.target.value as StoreEmployeeDeductionRequest["calculation_type"])}>{["fixed", "per_day", "per_hour", "percentage", "formula"].map((type) => <option key={type} value={type}>{type}</option>)}</select><Input aria-label="Efektif dari" required type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} /><Input aria-label="Efektif sampai" type="date" min={effectiveFrom} value={effectiveTo} onChange={(event) => setEffectiveTo(event.target.value)} /></div><Button size="sm" type="submit" disabled={add.isPending || !componentId || !amount}><Plus data-icon="inline-start" />Tambah Potongan</Button></form> : null}</div>;
}
