import type { Metadata } from "next";
import { SessionsView } from "@/components/sessions-view";

export const metadata: Metadata = { title: "Session & device · GAWE HRIS" };

export default function SessionsPage() {
  return <SessionsView />;
}
