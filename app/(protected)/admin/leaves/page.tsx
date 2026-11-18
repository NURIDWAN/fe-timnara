import type { Metadata } from "next";
import { AdminLeaveView } from "@/components/admin-leave-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Cuti & Approval · GAWE HRIS" };
export default async function LeaveHomePage() { const session = await getServerSession(); if (!session) return null; return <AdminLeaveView view="overview" permissions={session.user.permissions}/>; }
