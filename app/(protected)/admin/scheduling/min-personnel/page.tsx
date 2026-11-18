import type { Metadata } from "next";
import { AdminSchedulingView } from "@/components/admin-scheduling-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Minimum Personel · GAWE HRIS" };

export default async function MinimumPersonnelPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminSchedulingView view="minimum" permissions={session.user.permissions} />;
}
