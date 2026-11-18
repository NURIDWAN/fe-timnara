import type { Metadata } from "next";
import { AdminLeaveView } from "@/components/admin-leave-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Kalender Cuti · GAWE HRIS" };
export default async function LeaveCalendarPage() { const session = await getServerSession(); if (!session) return null; return <AdminLeaveView view="calendar" permissions={session.user.permissions}/>; }
