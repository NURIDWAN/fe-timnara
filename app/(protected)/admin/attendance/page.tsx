import type { Metadata } from "next";
import { AdminAttendanceView } from "@/components/admin-attendance-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Presensi · GAWE HRIS" };

export default async function AttendancePage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminAttendanceView permissions={session.user.permissions} timezone={session.tenant.timezone} />;
}
