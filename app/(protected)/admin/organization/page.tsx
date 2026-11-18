import type { Metadata } from "next";
import { AdminOrganizationOverviewView } from "@/components/admin-organization-views";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Organisasi · GAWE HRIS" };

export default async function OrganizationPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminOrganizationOverviewView tenant={session.tenant} userName={session.user.name} permissions={session.user.permissions} />;
}
