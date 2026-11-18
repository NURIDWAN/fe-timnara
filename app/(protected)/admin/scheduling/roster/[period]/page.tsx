import type { Metadata } from "next";
import { AdminSchedulingView } from "@/components/admin-scheduling-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Matriks Roster · GAWE HRIS" };

export default async function RosterMatrixPage({ params }: { params: { period: string } }) {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminSchedulingView view="matrix" periodId={params.period} permissions={session.user.permissions} />;
}
