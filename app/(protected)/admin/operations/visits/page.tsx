import type { Metadata } from "next";
import { AdminOperationsView } from "@/components/admin-operations-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Kunjungan · GAWE HRIS" };
export default async function VisitsPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminOperationsView view="visits" permissions={session.user.permissions} />;
}
