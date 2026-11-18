import type { Metadata } from "next";
import { AdminSchedulingView } from "@/components/admin-scheduling-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Pola Shift · GAWE HRIS" };

export default async function ShiftPatternsPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminSchedulingView view="patterns" permissions={session.user.permissions} />;
}
