import type { Metadata } from "next";
import { AdminPayrollView } from "@/components/admin-payroll-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Payroll Run · GAWE HRIS" };
export default async function PayrollRunsPage() { const session = await getServerSession(); if (!session) return null; return <AdminPayrollView view="runs" permissions={session.user.permissions} />; }
