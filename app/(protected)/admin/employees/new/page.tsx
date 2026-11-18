import type { Metadata } from "next";
import { AdminEmployeeCreateView } from "@/components/admin-employee-create-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Tambah karyawan · GAWE HRIS" };

export default async function NewEmployeePage() {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminEmployeeCreateView permissions={session.user.permissions} />;
}
