"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import type { SearchResult, Platform } from "@/lib/types";
import { formatNumber } from "@/lib/utils";

interface CreatorCardProps {
  result: SearchResult;
  platform: Platform;
  showPlatformBadge?: boolean;
  isAdded: boolean;
  onAdd: () => void;
  onSelect?: () => void;
}

export default function CreatorCard({ result, platform, showPlatformBadge, isAdded, onAdd, onSelect }: CreatorCardProps) {
  const href = `/creators/${encodeURIComponent(result.profile.username)}?platform=${platform}&from=discover`;

  const avatarContent = result.profile.picture ? (
    <img src={result.profile.picture} alt={result.profile.username} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
  ) : (
    <div className="w-12 h-12 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0">
      <span className="text-ink-muted text-lg">{result.profile.username[0]?.toUpperCase()}</span>
    </div>
  );

  const nameContent = (
    <>
      <h3 className="font-semibold text-ink text-sm truncate">
        {result.profile.fullname || result.profile.username}
        {result.profile.isVerified && <span className="ml-1 text-blue-500">✓</span>}
      </h3>
      <p className="text-ink-secondary text-xs flex items-center gap-1.5">
        {showPlatformBadge && (
          platform === "instagram" ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
              <defs>
                <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#feda75"/>
                  <stop offset="25%" stopColor="#fa7e1e"/>
                  <stop offset="50%" stopColor="#d62976"/>
                  <stop offset="75%" stopColor="#962fbf"/>
                  <stop offset="100%" stopColor="#4f5bd5"/>
                </linearGradient>
              </defs>
              <rect x="2" y="2" width="20" height="20" rx="6" stroke="url(#ig-grad)" strokeWidth="2"/>
              <circle cx="12" cy="12" r="4.5" stroke="url(#ig-grad)" strokeWidth="2"/>
              <circle cx="17.5" cy="6.5" r="1.5" fill="url(#ig-grad)"/>
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 text-ink">
              <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.15 15.2a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.87a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.01-.3z"/>
            </svg>
          )
        )}
        @{result.profile.username}
      </p>
    </>
  );

  return (
    <div className="bg-surface rounded-xl border border-edge p-5 hover:border-edge-strong transition-colors">
      <div className="flex items-start gap-4">
        {onSelect ? (
          <button onClick={onSelect} className="flex-shrink-0">{avatarContent}</button>
        ) : (
          <Link href={href} className="flex-shrink-0">{avatarContent}</Link>
        )}

        <div className="flex-1 min-w-0">
          {onSelect ? (
            <button onClick={onSelect} className="text-left hover:underline">{nameContent}</button>
          ) : (
            <Link href={href} className="hover:underline">{nameContent}</Link>
          )}

          <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-ink-secondary">
              <span className="font-medium text-ink">{formatNumber(result.profile.followers)}</span> followers
            </span>
            <span className="text-xs text-ink-secondary">
              <span className="font-medium text-ink">{(result.profile.engagementRate * 100).toFixed(1)}%</span> ER
            </span>
          </div>

          {result.match?.influencer?.geo?.country?.name && (
            <p className="text-xs text-ink-muted mt-1">
              {[result.match.influencer.geo.city?.name, result.match.influencer.geo.country.name].filter(Boolean).join(", ")}
            </p>
          )}
        </div>

        <button
          onClick={() => !isAdded && onAdd()}
          disabled={isAdded}
          className={`flex-shrink-0 p-2 rounded-lg transition-colors ${
            isAdded ? "bg-emerald-50 text-emerald-600" : "bg-surface-tertiary text-ink-secondary hover:bg-surface-secondary hover:text-ink"
          }`}
          title={isAdded ? "Added to watchlist" : "Add to watchlist"}
        >
          {isAdded ? <Check size={16} /> : <Plus size={16} />}
        </button>
      </div>
    </div>
  );
}
