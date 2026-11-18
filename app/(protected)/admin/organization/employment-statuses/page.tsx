import type { Metadata } from "next";
import { AdminOrganizationReferenceView } from "@/components/admin-organization-views";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Status Kepegawaian · GAWE HRIS" };

export default async function OrganizationEmploymentStatusesPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminOrganizationReferenceView mode="employment-statuses" permissions={session.user.permissions} />;
}
