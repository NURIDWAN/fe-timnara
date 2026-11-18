import type { Metadata } from "next";
import { AdminPayrollView } from "@/components/admin-payroll-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Lembur · GAWE HRIS" };
export default async function PayrollOvertimePage() { const session = await getServerSession(); if (!session) return null; return <AdminPayrollView view="overtime" permissions={session.user.permissions} />; }
