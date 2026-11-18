import type { Metadata } from "next";
import { AdminEmployeeDetailView } from "@/components/admin-employee-detail-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Detail karyawan · GAWE HRIS" };

export default async function EmployeeDetailPage({ params }: { params: { employee: string } }) {
  const session = await getServerSession();
  if (!session) return null;
  return <AdminEmployeeDetailView employeeId={params.employee} permissions={session.user.permissions} />;
}
