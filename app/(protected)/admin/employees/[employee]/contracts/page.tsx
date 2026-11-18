import type { Metadata } from "next";
import { AdminEmployeeOperationsView } from "@/components/admin-employee-operations-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Kontrak karyawan · GAWE HRIS" };

export default async function EmployeeContractsPage({ params }: { params: { employee: string } }) {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminEmployeeOperationsView employeeId={params.employee} mode="contracts" permissions={session.user.permissions} />;
}
