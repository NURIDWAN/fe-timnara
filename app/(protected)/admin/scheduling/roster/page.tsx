import type { Metadata } from "next";
import { AdminSchedulingView } from "@/components/admin-scheduling-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Periode Roster · GAWE HRIS" };

export default async function RosterPeriodsPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminSchedulingView view="periods" permissions={session.user.permissions} />;
}
