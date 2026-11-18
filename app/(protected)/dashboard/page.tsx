import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Overview · GAWE HRIS" };

export default async function DashboardPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <DashboardView permissions={session.user.permissions} />;
}
