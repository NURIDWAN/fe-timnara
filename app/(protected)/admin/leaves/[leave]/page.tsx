import type { Metadata } from "next";
import { AdminLeaveView } from "@/components/admin-leave-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Detail Pengajuan Cuti · GAWE HRIS" };
export default async function LeaveDetailPage({ params }: { params: { leave: string } }) { const session = await getServerSession(); if (!session) return null; return <AdminLeaveView view="detail" leaveId={params.leave} permissions={session.user.permissions}/>; }
