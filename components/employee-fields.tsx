"use client";

import type { ReactNode } from "react";
import { FormField, TextField } from "@/components/admin-form";

export const selectClass = "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

export function SelectField({ label, name, value, options, required, error, placeholder = "Pilih opsi" }: { label: string; name: string; value?: string; options: Array<{ id: string; code?: string; name: string }>; required?: boolean; error?: string[]; placeholder?: string }) {
  return <FormField label={label} name={name} error={error}><select id={name} name={name} required={required} defaultValue={value ?? ""} className={selectClass}><option value="">{placeholder}</option>{options.map((option) => <option key={option.id} value={option.id}>{option.code ? `${option.code} · ` : ""}{option.name}</option>)}</select></FormField>;
}

export function OperationCard({ title, description, children, className = "" }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6 ${className}`}><div className="mb-5"><h2 className="text-base font-semibold">{title}</h2>{description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}</div>{children}</section>;
}

export function TextareaField({ label, name, defaultValue, error, placeholder }: { label: string; name: string; defaultValue?: string | null; error?: string[]; placeholder?: string }) {
  return <FormField label={label} name={name} error={error}><textarea id={name} name={name} defaultValue={defaultValue ?? ""} placeholder={placeholder} className="min-h-24 w-full rounded-lg border border-input bg-background p-3 text-sm" /></FormField>;
}

export { TextField };
