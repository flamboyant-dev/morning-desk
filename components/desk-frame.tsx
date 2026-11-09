"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Clapperboard, House, Lock, Radio, UserRound } from "lucide-react";
import { InstallButton } from "@/components/install-button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", label: "Home", icon: House },
  { href: "/live", label: "Live", icon: Radio },
  { href: "/library", label: "Library", icon: Clapperboard },
  { href: "/settings", label: "You", icon: UserRound },
];

function active(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DeskFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    try {
      await fetch("/api/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } finally {
      setLeaving(false);
    }
  }

  return (
    <div className="min-h-full bg-black text-white">
      <header className="sticky top-0 z-50 flex h-14 items-center gap-3 bg-black/85 px-3 backdrop-blur-md md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            M
          </span>
          <span className="text-lg font-semibold tracking-tight">Morning</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Desk">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "rounded-full px-3 py-1.5 text-sm",
                active(pathname, link.href)
                  ? "bg-white text-black"
                  : "text-zinc-300 hover:bg-white/10 hover:text-white",
              )}
              aria-current={active(pathname, link.href) ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <InstallButton />
          <button
            type="button"
            onClick={logout}
            disabled={leaving}
            aria-label={leaving ? "Locking" : "Lock"}
            className="grid size-9 place-items-center rounded-full text-zinc-200 hover:bg-white/10 disabled:opacity-50"
          >
            <Lock className="size-4" />
          </button>
        </div>
      </header>
      <main className="pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:pb-10">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
        aria-label="Desk"
      >
        <ul className="grid grid-cols-4">
          {links.map((link) => {
            const Icon = link.icon;
            const on = active(pathname, link.href);
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 text-[11px]",
                    on ? "text-white" : "text-zinc-500",
                  )}
                  aria-current={on ? "page" : undefined}
                >
                  <Icon className="size-5" />
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
