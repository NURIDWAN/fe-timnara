import type { Metadata } from "next";
import { AdminOperationsView } from "@/components/admin-operations-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Pelanggaran · GAWE HRIS" };
export default async function ViolationsPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminOperationsView view="violations" permissions={session.user.permissions} />;
}
