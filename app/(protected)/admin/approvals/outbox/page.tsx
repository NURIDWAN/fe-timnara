import type { Metadata } from "next";
import { AdminLeaveView } from "@/components/admin-leave-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Pengajuan Saya · GAWE HRIS" };
export default async function ApprovalOutboxPage() { const session = await getServerSession(); if (!session) return null; return <AdminLeaveView view="outbox" permissions={session.user.permissions}/>; }
