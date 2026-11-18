import type { Metadata } from "next";
import { AdminLeaveView } from "@/components/admin-leave-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Pengajuan Cuti · GAWE HRIS" };
export default async function LeaveRequestsPage() { const session = await getServerSession(); if (!session) return null; return <AdminLeaveView view="requests" permissions={session.user.permissions}/>; }
