import type { Metadata } from "next";
import { AdminLeaveView } from "@/components/admin-leave-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Inbox Persetujuan · GAWE HRIS" };
export default async function ApprovalInboxPage() { const session = await getServerSession(); if (!session) return null; return <AdminLeaveView view="inbox" permissions={session.user.permissions}/>; }
