import type { Metadata } from "next";
import { AdminLeaveView } from "@/components/admin-leave-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Ajukan Cuti · GAWE HRIS" };
export default async function NewLeavePage() { const session = await getServerSession(); if (!session) return null; return <AdminLeaveView view="new" permissions={session.user.permissions}/>; }
