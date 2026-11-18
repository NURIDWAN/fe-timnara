import type { Metadata } from "next";
import { AdminPayrollView } from "@/components/admin-payroll-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Slip Gaji · GAWE HRIS" };
export default async function PayrollPayslipsPage() { const session = await getServerSession(); if (!session) return null; return <AdminPayrollView view="payslips" permissions={session.user.permissions} />; }
