import type { Metadata } from "next";
import { AdminOrganizationReferenceView } from "@/components/admin-organization-views";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Kelola Departemen · GAWE HRIS" };

export default async function OrganizationDepartmentsPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminOrganizationReferenceView mode="departments" permissions={session.user.permissions} />;
}
