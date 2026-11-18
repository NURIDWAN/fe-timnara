import type { Metadata } from "next";
import { AdminAuditView } from "@/components/admin-audit-view";
import { getServerSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Audit Log · GAWE HRIS" };
export default async function AuditLogsPage() { const session = await getServerSession(); if (!session) return null; return <AdminAuditView permissions={session.user.permissions} />; }
