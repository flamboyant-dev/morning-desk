import type { Metadata } from "next";
import { LiveDesk } from "@/components/live-desk";

export const metadata: Metadata = { title: "Live" };

export default function LivePage() {
  return <LiveDesk />;
}
