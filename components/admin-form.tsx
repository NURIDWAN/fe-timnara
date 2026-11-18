"use client";

import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";

export function AdminFormDialog({
  open,
  title,
  description,
  onClose,
  onSubmit,
  pending,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  pending?: boolean;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border bg-card p-6 shadow-xl" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div><h2 className="text-lg font-semibold">{title}</h2>{description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}</div>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Tutup" onClick={onClose}>×</Button>
        </div>
        <div className="space-y-4">{children}</div>
        <div className="mt-6 flex justify-end gap-2 border-t pt-5"><Button type="button" variant="outline" onClick={onClose}>Batal</Button><Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan"}</Button></div>
      </form>
    </div>
  );
}

export function FormField({ label, name, error, children }: { label: string; name?: string; error?: string[]; children: ReactNode }) {
  return <div className="space-y-2"><Label htmlFor={name}>{label}</Label>{children}{error?.map((message) => <p key={message} className="text-xs text-destructive">{message}</p>)}</div>;
}

export function TextField(props: React.ComponentProps<typeof Input> & { label: string; error?: string[] }) {
  const { label, error, id, name, ...inputProps } = props;
  return <FormField label={label} name={id ?? name} error={error}><Input id={id ?? name} name={name} {...inputProps} /></FormField>;
}

export function errorFields(error: unknown) {
  return error instanceof ApiError ? error.fieldErrors ?? {} : {};
}
