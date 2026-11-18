import type { Metadata } from "next";
import { AdminOperationsView } from "@/components/admin-operations-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Pengumuman · GAWE HRIS" };
export default async function AnnouncementsPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminOperationsView view="announcements" permissions={session.user.permissions} />;
}
