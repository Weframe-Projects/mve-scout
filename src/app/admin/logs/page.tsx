"use client";

import { useEffect, useState, useCallback } from "react";

interface SearchLog {
  id: number;
  created_at: string;
  action: string;
  platform: string | null;
  query: string | null;
  filters: Record<string, unknown> | null;
  result_count: number | null;
  user_agent: string | null;
}

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<SearchLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ limit: "200" });
    if (filter !== "all") params.set("action", filter);
    const res = await fetch(`/api/search-logs?${params}`);
    const data = await res.json();
    setLogs(data.logs || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", {
      day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    });
  };

  const formatFilters = (filters: Record<string, unknown> | null) => {
    if (!filters) return "—";
    const parts: string[] = [];
    const inf = filters.influencer as Record<string, unknown> | undefined;
    const aud = filters.audience as Record<string, unknown> | undefined;

    if (inf?.gender) parts.push(`Gender: ${inf.gender}`);
    if (inf?.followers) {
      const f = inf.followers as { min?: number; max?: number };
      parts.push(`Followers: ${f.min || 0}–${f.max || "∞"}`);
    }
    if (inf?.engagementRate) parts.push(`ER: >${typeof inf.engagementRate === "object" ? (inf.engagementRate as { min: number }).min * 100 : Number(inf.engagementRate) * 100}%`);
    if (inf?.relevance) {
      const tags = inf.relevance as string[];
      parts.push(`Niche: ${tags.slice(0, 3).join(", ")}${tags.length > 3 ? "…" : ""}`);
    }
    if (inf?.location) parts.push("Location filter ✓");
    if (aud?.location) parts.push("Audience location ✓");

    // AI search filters
    if (filters.gender) parts.push(`Gender: ${filters.gender}`);
    if (filters.engagementRate) {
      const er = filters.engagementRate as { min: number };
      parts.push(`ER: >${er.min * 100}%`);
    }
    if (filters.followersCount) {
      const f = filters.followersCount as { min?: number; max?: number };
      parts.push(`Followers: ${f.min || 0}–${f.max || "∞"}`);
    }

    return parts.length > 0 ? parts.join(" · ") : "No filters";
  };

  const actionLabel = (action: string) => {
    switch (action) {
      case "search": return "Filter Search";
      case "ai-search": return "AI Search";
      case "report": return "Profile View";
      case "lookup": return "Profile View";
      default: return action;
    }
  };

  const actionColor = (action: string) => {
    switch (action) {
      case "search": return "bg-blue-100 text-blue-700";
      case "ai-search": return "bg-purple-100 text-purple-700";
      case "report":
      case "lookup": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Search Logs</h1>
            <p className="text-sm text-gray-500 mt-1">See what your team is searching for</p>
          </div>
          <button
            onClick={fetchLogs}
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm hover:bg-gray-800 transition"
          >
            Refresh
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-4">
          {[
            { key: "all", label: "All" },
            { key: "search", label: "Filter Search" },
            { key: "ai-search", label: "AI Search" },
            { key: "report", label: "Profile Views" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                filter === tab.key
                  ? "bg-gray-900 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading logs...</div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No logs yet. Searches will appear here once someone uses the tool.</div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Platform</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Query / Filters</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Results</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${actionColor(log.action)}`}>
                        {actionLabel(log.action)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 capitalize">
                      {log.platform || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-md truncate">
                      {log.query
                        ? <span className="font-medium">&quot;{log.query}&quot;</span>
                        : formatFilters(log.filters)}
                      {log.query && log.filters && (
                        <span className="text-gray-400 ml-2">· {formatFilters(log.filters)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 font-medium">
                      {log.result_count?.toLocaleString() ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
