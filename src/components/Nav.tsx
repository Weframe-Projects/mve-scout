"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Users } from "lucide-react";

const tabs = [
  { label: "Search", href: "/discover", icon: Search },
  { label: "Watchlist", href: "/watchlist", icon: Users },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 bg-surface border-b border-edge">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
        <Link href="/discover" className="flex items-center gap-2.5">
          <img src="/mve-logo.png" alt="MVE" className="h-7 w-7 rounded" />
          <span className="text-lg font-bold text-ink">MVE</span>
          <span className="text-sm font-medium text-ink-secondary">Scout</span>
        </Link>

        <nav className="flex items-center gap-1">
          {tabs.map((tab) => {
            const isActive =
              pathname === tab.href || pathname.startsWith(tab.href + "/");
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-surface-tertiary text-ink"
                    : "text-ink-secondary hover:text-ink hover:bg-surface-secondary"
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
