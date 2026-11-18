import type { Metadata } from "next";
import { AdminSchedulingView } from "@/components/admin-scheduling-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Assignment Jadwal · GAWE HRIS" };

export default async function ScheduleAssignmentsPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminSchedulingView view="assignments" permissions={session.user.permissions} />;
}
