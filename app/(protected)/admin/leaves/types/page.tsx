import type { Metadata } from "next";
import { AdminLeaveView } from "@/components/admin-leave-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Jenis Cuti · GAWE HRIS" };
export default async function LeaveTypesPage() { const session = await getServerSession(); if (!session) return null; return <AdminLeaveView view="types" permissions={session.user.permissions}/>; }
