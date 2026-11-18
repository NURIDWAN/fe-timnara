"use client";

import Link from "next/link";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EmployeeFields, employeeFormPayload, type EmployeeFormOptions, type EmployeeFormSection } from "@/components/employee-form";
import { OperationCard } from "@/components/employee-fields";
import { useEmployee } from "@/components/employee-operation-layout";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/client";
import type { Branch, Employee, OrganizationUnit, StoreEmployeeRequest, UpdateEmployeeRequest } from "@/lib/api/types";
import { ErrorState, LoadingState, UnauthorizedState, getErrorMessage } from "@/components/page-states";
import { errorFields } from "@/components/admin-form";
import { hasPermission } from "@/lib/permissions";
import { useEffect, useState } from "react";

const referenceNames = ["departments", "positions", "groups", "employment-statuses"] as const;
const sections: Array<{ label: string; section: EmployeeFormSection; title: string; description: string }> = [{ label: "1. Data pribadi", section: "personal", title: "1 · Data pribadi", description: "Semua karyawan wajib mengisi data personal." }, { label: "2. Kepegawaian", section: "employment", title: "2 · Data kepegawaian", description: "NIP unik per tenant · cabang, departemen, jabatan wajib." }, { label: "3. Bank & pajak", section: "bank", title: "3 · Bank & pajak", description: "Data sensitif dicatat pada audit log." }, { label: "4. Kontak darurat", section: "emergency", title: "4 · Kontak darurat", description: "Dihubungi saat keadaan darurat." }];
const requiredFields: Record<EmployeeFormSection, string[]> = { personal: ["employee_number", "full_name", "gender"], employment: ["branch_id", "department_id", "position_id", "employment_status_id", "join_date"], bank: [], emergency: [] };

export function AdminEmployeeCreateView({ permissions, employeeId }: { permissions: string[]; employeeId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [clientErrors, setClientErrors] = useState<Record<string, string[]>>({});
  const canManage = hasPermission(permissions, "employee.manage");
  const employeeQuery = useEmployee(employeeId ?? "", Boolean(employeeId) && canManage);
  const employee = employeeQuery.data;
  const branches = useQuery({ queryKey: ["organization", "branches"], queryFn: () => apiFetch<Branch[]>("organization/branches"), enabled: canManage });
  const references = useQueries({ queries: referenceNames.map((name) => ({ queryKey: ["organization", name], queryFn: () => apiFetch<OrganizationUnit[]>(`organization/${name}`), enabled: canManage })) });
  const employees = useQuery({ queryKey: ["employees", "supervisors"], queryFn: () => apiFetch<Employee[]>("employees?per_page=100&is_active=true"), enabled: canManage });
  const save = useMutation({ mutationFn: ({ payload, editing }: { payload: StoreEmployeeRequest | UpdateEmployeeRequest; editing: boolean }) => apiFetch<Employee>(editing ? `employees/${employeeId}` : "employees", { method: editing ? "PATCH" : "POST", body: JSON.stringify(payload) }), onSuccess: async (savedEmployee) => { toast.success(employee ? "Karyawan berhasil diperbarui" : "Karyawan berhasil dibuat"); await queryClient.invalidateQueries({ queryKey: ["employees"] }); await queryClient.invalidateQueries({ queryKey: ["employee", savedEmployee.id] }); router.push(`/admin/employees/${savedEmployee.id}`); }, onError: (error) => toast.error(getErrorMessage(error)) });
  const serverErrors = errorFields(save.error);
  useEffect(() => {
    if (!save.error) return;
    const currentErrors = errorFields(save.error);
    const firstError = sections.findIndex((item) => Object.keys(currentErrors).some((field) => fieldBelongsToSection(field, item.section)));
    if (firstError >= 0) setStep(firstError);
  }, [save.error]);
  if (!canManage) return <UnauthorizedState />;
  const loading = branches.isLoading || employees.isLoading || references.some((query) => query.isLoading) || (Boolean(employeeId) && employeeQuery.isLoading);
  const options: EmployeeFormOptions = { branches: branches.data ?? [], departments: references[0]?.data ?? [], positions: references[1]?.data ?? [], groups: references[2]?.data ?? [], statuses: references[3]?.data ?? [], supervisors: employees.data ?? [] };
  if (loading) return <LoadingState label="Memuat data karyawan" />;
  if (employeeQuery.isError || (employeeId && !employee)) return <ErrorState message={getErrorMessage(employeeQuery.error)} retry={() => void employeeQuery.refetch()} />;
  const current = sections[step];
  const fields = { ...serverErrors, ...clientErrors };
  const validateCurrentStep = () => {
    const form = document.getElementById("create-employee-form");
    if (!(form instanceof HTMLFormElement)) return true;
    const data = new FormData(form);
    const errors: Record<string, string[]> = {};
    for (const field of employee ? [] : requiredFields[current.section]) if (!String(data.get(field) ?? "").trim()) errors[field] = ["Field ini wajib diisi."];
    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };
  const editing = Boolean(employee);
  const targetEmployeeId = employee?.id ?? employeeId ?? "";
  const title = editing ? "Edit karyawan" : "Tambah karyawan";
  const description = editing ? "Perbarui data personal, kepegawaian, bank, pajak, dan kontak darurat." : "Lengkapi data personal, kepegawaian, bank, pajak, dan kontak darurat.";
  return <div className="w-full space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><Link href={editing ? `/admin/employees/${targetEmployeeId}` : "/admin/employees"} className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="mr-2 size-4" />Kembali {editing ? "ke detail" : "ke daftar"}</Link><p className="text-sm font-semibold text-primary">Master data · Karyawan</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-2 text-sm text-muted-foreground">{description}</p></div><div className="flex gap-2"><Button asChild variant="outline"><Link href={editing ? `/admin/employees/${targetEmployeeId}` : "/admin/employees"}>Batal</Link></Button><Button type={step === sections.length - 1 ? "submit" : "button"} form="create-employee-form" disabled={save.isPending} onClick={() => { if (step < sections.length - 1 && validateCurrentStep()) setStep((value) => value + 1); }}>{step === sections.length - 1 ? (save.isPending ? "Menyimpan..." : editing ? "Simpan perubahan" : "Simpan karyawan") : "Lanjutkan"}</Button></div></div>{save.error ? <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"><AlertCircle className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">Data belum dapat disimpan</p><p className="mt-1">{getErrorMessage(save.error)}</p><p className="mt-1 text-xs text-red-700">Periksa field yang ditandai pada langkah terkait.</p></div></div> : null}<div className="flex w-full flex-wrap gap-2 rounded-xl border bg-card p-2 shadow-sm">{sections.map((item, index) => <Step key={item.section} label={item.label} active={index === step} hasError={Object.keys(fields).some((field) => fieldBelongsToSection(field, item.section))} onClick={() => setStep(index)} />)}</div><form id="create-employee-form" noValidate className="w-full" onSubmit={(event) => { event.preventDefault(); if (step < sections.length - 1) { if (validateCurrentStep()) setStep((value) => value + 1); return; } setClientErrors({}); save.mutate({ payload: employeeFormPayload(new FormData(event.currentTarget), editing), editing }); }}><OperationCard title={current.title} description={current.description} className="w-full"><EmployeeFields employee={employee} options={options} fields={fields} section={current.section} /></OperationCard></form></div>;
}

function Step({ label, active = false, hasError = false, onClick }: { label: string; active?: boolean; hasError?: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`inline-flex items-center rounded-full border px-3 py-2 text-xs font-medium transition-colors ${active ? "border-blue-200 bg-blue-50 text-blue-700" : hasError ? "border-red-200 bg-red-50 text-red-700" : "text-muted-foreground hover:bg-muted"}`}><i className={`mr-2 size-2.5 rounded-full ${active ? "bg-blue-600" : hasError ? "bg-red-500" : "bg-slate-200"}`} />{label}{hasError ? <span className="ml-2">!</span> : null}</button>;
}

function fieldBelongsToSection(field: string, section: EmployeeFormSection) {
  if (section === "personal") return ["employee_number", "full_name", "nickname", "gender", "birth_place", "birth_date", "marital_status", "education_level", "religion", "blood_type", "phone", "email", "address"].includes(field);
  if (section === "employment") return ["branch_id", "department_id", "position_id", "employment_status_id", "group_id", "supervisor_id", "join_date", "exit_date", "branch_ids", "is_active", "lock_location", "lock_schedule", "web_access", "overtime_claim", "calculate_pph21"].includes(field);
  if (section === "bank") return ["bank_name", "bank_account_number", "bank_account_holder", "npwp_number", "bpjs_kesehatan_number", "bpjs_tk_number"].includes(field);
  return ["rfid_uid", "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation"].includes(field);
}
