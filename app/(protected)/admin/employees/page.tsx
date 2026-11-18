import type { Metadata } from "next";
import { AdminEmployeesView } from "@/components/admin-employees-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Karyawan · GAWE HRIS" };

export default async function EmployeesPage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminEmployeesView permissions={session.user.permissions} />;
}
