"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { WINDOW_LABEL } from "@/lib/time";

const links = [
  { href: "/", label: "Archive" },
  { href: "/settings", label: "Settings" },
];

export function DeskFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-full md:grid md:grid-cols-[15.5rem_1fr]">
      <aside className="border-b border-border/80 bg-background/70 px-4 py-4 backdrop-blur md:min-h-full md:border-r md:border-b-0 md:px-5 md:py-8">
        <div className="flex items-start justify-between gap-3 md:block">
          <div>
            <p className="font-heading text-2xl tracking-tight text-foreground">
              Morning desk
            </p>
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              {WINDOW_LABEL}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="md:mt-8"
            disabled={leaving}
            onClick={logout}
          >
            {leaving ? "Locking…" : "Lock"}
          </Button>
        </div>
        <nav className="mt-4 flex gap-2 md:mt-8 md:flex-col" aria-label="Desk">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                aria-current={active ? "page" : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="px-4 py-6 md:px-10 md:py-10">{children}</main>
    </div>
  );
}
