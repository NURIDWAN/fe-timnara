import type { Metadata } from "next";
import { AdminLeaveView } from "@/components/admin-leave-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Konfigurasi Approval · GAWE HRIS" };
export default async function ApprovalConfigurationPage() { const session = await getServerSession(); if (!session) return null; return <AdminLeaveView view="configuration" permissions={session.user.permissions}/>; }
