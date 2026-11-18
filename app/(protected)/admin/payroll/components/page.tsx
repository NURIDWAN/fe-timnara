import type { Metadata } from "next";
import { AdminPayrollView } from "@/components/admin-payroll-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Komponen & Gaji · GAWE HRIS" };
export default async function PayrollComponentsPage() { const session = await getServerSession(); if (!session) return null; return <AdminPayrollView view="components" permissions={session.user.permissions} />; }
