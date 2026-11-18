import type { Metadata } from "next";
import { AdminPayrollView } from "@/components/admin-payroll-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Pengaturan Payroll · GAWE HRIS" };
export default async function PayrollSettingsPage() { const session = await getServerSession(); if (!session) return null; return <AdminPayrollView view="settings" permissions={session.user.permissions} />; }
