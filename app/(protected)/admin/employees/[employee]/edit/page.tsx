import type { Metadata } from "next";
import { AdminEmployeeCreateView } from "@/components/admin-employee-create-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Edit karyawan · GAWE HRIS" };

export default async function EditEmployeePage({ params }: { params: { employee: string } }) {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminEmployeeCreateView employeeId={params.employee} permissions={session.user.permissions} />;
}
