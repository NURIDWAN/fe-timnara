import type { Metadata } from "next";
import { AdminOrganizationReferenceView } from "@/components/admin-organization-views";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Kelola Grup Karyawan · GAWE HRIS" };

export default async function OrganizationGroupsPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminOrganizationReferenceView mode="groups" permissions={session.user.permissions} />;
}
