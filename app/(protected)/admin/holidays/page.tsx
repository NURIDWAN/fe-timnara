import type { Metadata } from "next";
import { AdminLeaveView } from "@/components/admin-leave-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Hari Libur · GAWE HRIS" };
export default async function HolidaysPage() { const session = await getServerSession(); if (!session) return null; return <AdminLeaveView view="holidays" permissions={session.user.permissions}/>; }
