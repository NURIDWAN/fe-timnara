import type { Metadata } from "next";
import { AdminOperationsView } from "@/components/admin-operations-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Pembelajaran · GAWE HRIS" };
export default async function LmsPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminOperationsView view="lms" permissions={session.user.permissions} />;
}
