import type { Metadata } from "next";
import { AdminOrganizationReferenceView } from "@/components/admin-organization-views";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Kelola Jabatan · GAWE HRIS" };

export default async function OrganizationPositionsPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminOrganizationReferenceView mode="positions" permissions={session.user.permissions} />;
}
