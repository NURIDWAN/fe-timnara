import type { Metadata } from "next";
import { AdminPayrollView } from "@/components/admin-payroll-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Penyesuaian & Suplisi · GAWE HRIS" };
export default async function PayrollAdjustmentsPage() { const session = await getServerSession(); if (!session) return null; return <AdminPayrollView view="adjustments" permissions={session.user.permissions} />; }
