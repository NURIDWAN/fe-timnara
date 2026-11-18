import type { Metadata } from "next";
import { AdminUserCreateView } from "@/components/admin-user-create-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Tambah Pengguna Tenant · GAWE HRIS" };

export default async function NewTenantUserPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminUserCreateView permissions={session.user.permissions} tenant={session.tenant} />;
}
