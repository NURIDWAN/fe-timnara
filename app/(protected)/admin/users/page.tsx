import type { Metadata } from "next";
import { AdminUsersView } from "@/components/admin-users-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Pengguna · GAWE HRIS" };

export default async function UsersPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminUsersView permissions={session.user.permissions} />;
}
