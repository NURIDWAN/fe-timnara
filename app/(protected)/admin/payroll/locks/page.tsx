import type { Metadata } from "next";
import { AdminPayrollView } from "@/components/admin-payroll-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Lock Payroll · GAWE HRIS" };
export default async function PayrollLocksPage() { const session = await getServerSession(); if (!session) return null; return <AdminPayrollView view="locks" permissions={session.user.permissions} />; }
