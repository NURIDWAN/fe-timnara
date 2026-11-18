import type { Metadata } from "next";
import { AdminEmployeeOperationsView } from "@/components/admin-employee-operations-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Resign karyawan · GAWE HRIS" };

export default async function EmployeeResignationsPage({ params }: { params: { employee: string } }) {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminEmployeeOperationsView employeeId={params.employee} mode="resignations" permissions={session.user.permissions} />;
}
