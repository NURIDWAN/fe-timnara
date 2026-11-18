import type { Metadata } from "next";
import { AdminEmployeeOperationsView } from "@/components/admin-employee-operations-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Dokumen karyawan · GAWE HRIS" };

export default async function EmployeeDocumentsPage({ params }: { params: { employee: string } }) {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminEmployeeOperationsView employeeId={params.employee} mode="documents" permissions={session.user.permissions} />;
}
