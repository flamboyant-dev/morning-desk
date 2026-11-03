import { Suspense } from "react";
import { DeskFrame } from "@/components/desk-frame";

export default function DeskLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <p className="px-6 py-10 text-sm text-muted-foreground">Opening the desk…</p>
      }
    >
      <DeskFrame>{children}</DeskFrame>
    </Suspense>
  );
}
