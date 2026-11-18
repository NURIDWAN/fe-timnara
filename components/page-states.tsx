import { AlertCircle, Inbox, LockKeyhole } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LoadingState({ label = "Memuat data..." }: { label?: string }) {
  return <div className="space-y-4" aria-busy="true"><div className="h-8 w-48 animate-pulse rounded-md bg-muted" /><div className="h-24 animate-pulse rounded-xl bg-muted" /><div className="h-64 animate-pulse rounded-xl bg-muted" /><span className="sr-only">{label}</span></div>;
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/80 px-6 py-16 text-center"><div className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted"><Inbox className="size-5 text-muted-foreground" /></div><h2 className="font-semibold">{title}</h2><p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">{description}</p></div>;
}

export function ErrorState({ message = "Data belum dapat dimuat.", retry }: { message?: string; retry?: () => void }) {
  return <div className="flex items-center gap-4 rounded-xl border border-destructive/30 bg-card px-5 py-5"><div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10"><AlertCircle className="size-5 text-destructive" /></div><div className="min-w-0 flex-1"><h2 className="font-semibold">Terjadi kendala</h2><p className="mt-1 text-sm leading-5 text-muted-foreground">{message}</p></div>{retry ? <Button variant="outline" onClick={retry}>Coba lagi</Button> : null}</div>;
}

export function UnauthorizedState({ description = "Anda tidak memiliki permission untuk melihat halaman ini." }: { description?: string }) {
  return <div className="flex flex-col items-center justify-center rounded-xl border border-amber-500/30 bg-card px-6 py-16 text-center"><div className="mb-4 flex size-11 items-center justify-center rounded-full bg-amber-500/10"><LockKeyhole className="size-5 text-amber-600" /></div><h2 className="font-semibold">Akses terbatas</h2><p className="mt-1 max-w-sm text-sm leading-5 text-muted-foreground">{description}</p></div>;
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Data belum dapat dimuat.";
}
