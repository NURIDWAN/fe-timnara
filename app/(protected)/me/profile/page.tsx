import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSession } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = { title: "Profil saya · GAWE HRIS" };

export default async function ProfilePage() {
  const session = await getServerSession();
  if (!session) return null;
  return <div className="space-y-8"><PageHeader eyebrow="Akun saya" title="Profil saya" description="Identitas dan akses Anda pada tenant aktif." /><div className="grid items-stretch gap-4 lg:grid-cols-[1.1fr_0.9fr]"><Card className="h-full"><CardHeader><CardTitle>Informasi akun</CardTitle></CardHeader><CardContent className="grid gap-x-6 gap-y-6 sm:grid-cols-2"><ProfileField label="Nama" value={session.user.name} /><ProfileField label="Username" value={`@${session.user.username}`} /><ProfileField label="Email" value={session.user.email ?? "Belum diisi"} /><ProfileField label="Telepon" value={session.user.phone ?? "Belum diisi"} /><ProfileField label="Status akun" value={session.user.status} /><ProfileField label="Status membership" value={session.membership.status} /></CardContent></Card><Card className="h-full"><CardHeader><CardTitle>Role & permission</CardTitle></CardHeader><CardContent className="space-y-6"><div><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</p><div className="flex flex-wrap gap-2">{session.user.roles.map((role) => <Badge key={role}>{role}</Badge>)}</div></div><div><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Permission</p><div className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto">{session.user.permissions.map((permission) => <Badge key={permission} variant="outline" className="font-normal">{permission}</Badge>)}</div></div></CardContent></Card></div></div>;
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}
