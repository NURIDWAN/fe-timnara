import type { Metadata } from "next";
import { AdminPayrollView } from "@/components/admin-payroll-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Periode Payroll · GAWE HRIS" };
export default async function PayrollPeriodsPage() { const session = await getServerSession(); if (!session) return null; return <AdminPayrollView view="periods" permissions={session.user.permissions} />; }
