import type { Metadata } from "next";
import { AdminOrganizationBranchView } from "@/components/admin-organization-views";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Kelola Cabang · GAWE HRIS" };

export default async function OrganizationBranchesPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminOrganizationBranchView permissions={session.user.permissions} />;
}
