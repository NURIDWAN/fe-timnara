import type { Metadata } from "next";
import { AdminSchedulingView } from "@/components/admin-scheduling-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Tukar Shift · GAWE HRIS" };

export default async function ShiftSwapsPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminSchedulingView view="swaps" permissions={session.user.permissions} />;
}
