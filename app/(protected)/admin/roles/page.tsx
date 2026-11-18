import type { Metadata } from "next";
import { AdminRolesView } from "@/components/admin-roles-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Role & akses · GAWE HRIS" };

export default async function RolesPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminRolesView permissions={session.user.permissions} />;
}
