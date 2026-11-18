import type { Metadata } from "next";
import { AdminOperationsView } from "@/components/admin-operations-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Aktivitas · GAWE HRIS" };
export default async function ActivitiesPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminOperationsView view="activities" permissions={session.user.permissions} />;
}
