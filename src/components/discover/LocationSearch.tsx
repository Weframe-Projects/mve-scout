"use client";

import { useState, useEffect, useRef } from "react";
import { MapPin, X, Loader2 } from "lucide-react";
import { lookupLocations } from "@/lib/modash";

export interface LocationValue {
  id: string;
  name: string;
  title: string; // full title, e.g. "Greater London, England, United Kingdom"
}

interface LocationSearchProps {
  platform: "instagram" | "tiktok" | "both";
  value: LocationValue | null;
  onChange: (v: LocationValue | null) => void;
  /** compact = smaller padding for AI filters grid */
  compact?: boolean;
  /** Only show country-level results (no cities) */
  countriesOnly?: boolean;
}

export default function LocationSearch({ platform, value, onChange, compact, countriesOnly }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationValue[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search on query change (debounced 300ms)
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const p = platform === "both" ? "instagram" : platform;
        const locs = await lookupLocations(query, p);
        // Filter out nonsensical results (Modash sometimes returns unrelated places)
        let relevant = locs.filter((l) =>
          l.title.toLowerCase().includes(query.toLowerCase()) ||
          l.name.toLowerCase().includes(query.toLowerCase())
        );
        if (countriesOnly) {
          relevant = relevant.filter((l) => l.name === l.title);
        }
        relevant = relevant.slice(0, 7);
        setResults(relevant);
        setOpen(relevant.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, platform]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (loc: LocationValue) => {
    onChange(loc);
    setQuery("");
    setOpen(false);
    setResults([]);
  };

  const clear = () => {
    onChange(null);
    setQuery("");
  };

  const inputCls = compact
    ? "w-full pl-7 pr-7 py-2 rounded-lg border border-edge bg-surface text-ink text-xs placeholder:text-ink-muted focus:outline-none focus:border-ink-muted"
    : "w-full pl-8 pr-8 py-2.5 rounded-lg border border-edge bg-surface text-ink text-sm placeholder:text-ink-muted focus:outline-none focus:border-ink-muted";

  const iconSize = compact ? 12 : 14;

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chip */}
      {value ? (
        <div className={`flex items-center gap-1.5 px-3 ${compact ? "py-2" : "py-2.5"} rounded-lg border border-edge bg-surface`}>
          <MapPin size={iconSize} className="text-ink-muted shrink-0" />
          <span className={`flex-1 truncate ${compact ? "text-xs" : "text-sm"} text-ink`} title={value.title}>
            {value.title}
          </span>
          <button onClick={clear} className="text-ink-muted hover:text-ink transition-colors shrink-0">
            <X size={iconSize} />
          </button>
        </div>
      ) : (
        <>
          <MapPin size={iconSize} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={countriesOnly ? "e.g. United States, United Kingdom" : "e.g. London, Los Angeles, UK"}
            className={inputCls}
          />
          {loading && (
            <Loader2 size={iconSize} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted animate-spin" />
          )}
        </>
      )}

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface border border-edge rounded-lg shadow-lg overflow-hidden">
          {results.map((loc) => (
            <button
              key={loc.id}
              onMouseDown={(e) => { e.preventDefault(); select(loc); }}
              className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-surface-secondary transition-colors"
            >
              <MapPin size={12} className="text-ink-muted shrink-0 mt-0.5" />
              <span className="text-sm text-ink leading-tight">{loc.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
