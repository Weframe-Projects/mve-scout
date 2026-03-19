"use client";

import { useState, useEffect, useRef } from "react";
import { Hash, X, Loader2 } from "lucide-react";
import { lookupTopicTag } from "@/lib/modash";

export interface TopicValue {
  tag: string; // e.g. "skincare"
}

interface TopicSearchProps {
  platform: "instagram" | "tiktok" | "both";
  value: TopicValue | null;
  onChange: (v: TopicValue | null) => void;
  compact?: boolean;
}

export default function TopicSearch({ platform, value, onChange, compact }: TopicSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        const res = await fetch("/api/modash", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "topics", platform: p, query }),
        });
        if (!res.ok) { setResults([]); return; }
        const data = await res.json();
        const tags: string[] = Array.isArray(data) ? data : (data.tags || data.topics || []);
        setResults(tags.slice(0, 8));
        setOpen(tags.length > 0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, platform]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (tag: string) => {
    onChange({ tag });
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
      {value ? (
        <div className={`flex items-center gap-1.5 px-3 ${compact ? "py-2" : "py-2.5"} rounded-lg border border-edge bg-surface`}>
          <Hash size={iconSize} className="text-ink-muted shrink-0" />
          <span className={`flex-1 truncate ${compact ? "text-xs" : "text-sm"} text-ink`}>
            {value.tag}
          </span>
          <button onClick={clear} className="text-ink-muted hover:text-ink transition-colors shrink-0">
            <X size={iconSize} />
          </button>
        </div>
      ) : (
        <>
          <Hash size={iconSize} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. skincare, yoga, crypto"
            className={inputCls}
          />
          {loading && (
            <Loader2 size={iconSize} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-muted animate-spin" />
          )}
        </>
      )}

      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface border border-edge rounded-lg shadow-lg overflow-hidden max-h-48 overflow-y-auto">
          {results.map((tag) => (
            <button
              key={tag}
              onMouseDown={(e) => { e.preventDefault(); select(tag); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-secondary transition-colors"
            >
              <Hash size={12} className="text-ink-muted shrink-0" />
              <span className="text-sm text-ink">{tag}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
