import type { Metadata } from "next";
import { RecordingsDesk } from "@/components/recordings-desk";

export const metadata: Metadata = { title: "Archive" };

export default function ArchivePage() {
  return <RecordingsDesk />;
}
