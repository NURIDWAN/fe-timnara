import type { Metadata } from "next";
import { AdminLeaveView } from "@/components/admin-leave-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Izin Terlambat & Pulang Cepat · GAWE HRIS" };
export default async function LeavePermitsPage() { const session = await getServerSession(); if (!session) return null; return <AdminLeaveView view="permits" permissions={session.user.permissions}/>; }
