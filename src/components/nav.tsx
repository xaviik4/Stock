"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Portfolio" },
  { href: "/analyzer", label: "Analyzer" },
  { href: "/simulator", label: "Stock sim" },
  { href: "/retirement", label: "Retirement" },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-hairline bg-surface">
      <div className="w-full max-w-[1180px] mx-auto px-5 sm:px-8 flex items-center gap-6 h-14">
        <Link href="/" className="font-semibold tracking-tight shrink-0">
          Portfolio Desk
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {LINKS.map((link) => {
            const active =
              link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`px-3 py-1.5 rounded-md text-sm whitespace-nowrap transition-colors ${
                  active
                    ? "bg-surface-2 text-ink font-medium"
                    : "text-ink-2 hover:text-ink hover:bg-surface-2"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
