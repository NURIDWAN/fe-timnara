import type { Metadata } from "next";
import { AdminSchedulingView } from "@/components/admin-scheduling-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Master Jadwal · GAWE HRIS" };

export default async function SchedulingPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminSchedulingView view="master" permissions={session.user.permissions} />;
}
