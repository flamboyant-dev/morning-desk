import type { Metadata } from "next";
import { Suspense } from "react";
import { RecordingsDesk } from "@/components/recordings-desk";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <Suspense fallback={<p className="px-4 py-10 text-sm text-zinc-400">Opening the library…</p>}>
      <RecordingsDesk />
    </Suspense>
  );
}
