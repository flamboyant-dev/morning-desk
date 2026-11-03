"use client";

import { Button } from "@/components/ui/button";

export default function DeskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <h1 className="font-heading text-3xl">The desk hit a snag</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        {error.message || "Something unexpected stopped this page."}
      </p>
      <Button className="mt-6 h-11" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
