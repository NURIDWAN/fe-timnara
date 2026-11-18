import type { Metadata } from "next";
import { AdminLeaveView } from "@/components/admin-leave-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Saldo Cuti · GAWE HRIS" };
export default async function LeaveBalancesPage() { const session = await getServerSession(); if (!session) return null; return <AdminLeaveView view="balances" permissions={session.user.permissions}/>; }
