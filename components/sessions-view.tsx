"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Laptop, LogOut, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { UserDevice } from "@/lib/api/types";
import { EmptyState, ErrorState, LoadingState, getErrorMessage } from "@/components/page-states";
import { PageHeader } from "@/components/page-header";

export function SessionsView() {
  const queryClient = useQueryClient();
  const sessions = useQuery({ queryKey: ["sessions"], queryFn: () => apiFetch<UserDevice[]>("auth/sessions") });
  const revoke = useMutation({
    mutationFn: (deviceId: string) => apiFetch<null>(`auth/sessions/${deviceId}`, { method: "DELETE" }),
    onSuccess: async () => { toast.success("Sesi berhasil dicabut"); await queryClient.invalidateQueries({ queryKey: ["sessions"] }); },
    onError: (error) => toast.error(error instanceof ApiError ? error.message : "Sesi belum dapat dicabut."),
  });
  return <div className="space-y-8"><PageHeader eyebrow="Keamanan akun" title="Session & device" description="Tinjau perangkat yang terhubung ke akun Anda." /><Card><CardHeader><CardTitle>Perangkat terdaftar</CardTitle></CardHeader><CardContent>{sessions.isLoading ? <LoadingState /> : sessions.isError ? <ErrorState message={getErrorMessage(sessions.error)} retry={() => void sessions.refetch()} /> : !sessions.data?.length ? <EmptyState title="Belum ada sesi" description="Sesi perangkat akan tercatat setelah Anda login." /> : <div className="space-y-3">{sessions.data.map((device) => <DeviceRow key={device.id} device={device} pending={revoke.isPending} onRevoke={() => revoke.mutate(device.id)} />)}</div>}</CardContent></Card></div>;
}

function DeviceRow({ device, pending, onRevoke }: { device: UserDevice; pending: boolean; onRevoke: () => void }) {
  const Icon = device.platform.toLowerCase().includes("web") ? Laptop : Smartphone;
  return <div className="flex flex-col gap-4 rounded-lg border border-border/70 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><div className="rounded-lg bg-muted p-2.5"><Icon className="size-5 text-muted-foreground" /></div><div className="min-w-0"><p className="truncate font-medium">{device.device_name ?? device.device_id}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{device.platform}{device.app_version ? ` · v${device.app_version}` : ""} · terakhir aktif {device.last_seen_at ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(device.last_seen_at)) : "belum diketahui"}</p></div></div><div className="flex items-center gap-3 sm:shrink-0"><Badge variant={device.revoked_at ? "outline" : "secondary"}>{device.revoked_at ? "Dicabut" : "Aktif"}</Badge>{!device.revoked_at ? <Button variant="outline" size="sm" disabled={pending} onClick={onRevoke}><LogOut className="mr-2 size-4" />Cabut</Button> : null}</div></div>;
}
