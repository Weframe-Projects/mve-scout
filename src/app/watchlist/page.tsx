"use client";

import { useState, useEffect, useCallback } from "react";
import Nav from "@/components/Nav";
import PlatformLogo from "@/components/PlatformLogo";
import type { WatchlistCreator, CreatorStatus } from "@/lib/types";
import { formatNumber, formatPercent, statusLabel, statusColor } from "@/lib/utils";
import { Users, Plus, X, Loader2, ChevronDown, List, LayoutGrid, Trash2 } from "lucide-react";
import Link from "next/link";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";

const STATUSES: CreatorStatus[] = [
  "watching",
  "contacted",
  "in_talks",
  "signed",
  "passed",
];

const STATUS_ACCENT: Record<CreatorStatus, { bg: string; border: string; header: string }> = {
  watching: { bg: "bg-blue-50", border: "border-blue-200", header: "bg-blue-100 text-blue-800" },
  contacted: { bg: "bg-amber-50", border: "border-amber-200", header: "bg-amber-100 text-amber-800" },
  in_talks: { bg: "bg-purple-50", border: "border-purple-200", header: "bg-purple-100 text-purple-800" },
  signed: { bg: "bg-emerald-50", border: "border-emerald-200", header: "bg-emerald-100 text-emerald-700" },
  passed: { bg: "bg-gray-50", border: "border-gray-200", header: "bg-gray-100 text-gray-600" },
};

export default function WatchlistPage() {
  const [creators, setCreators] = useState<WatchlistCreator[]>([]);
  const [statuses, setStatuses] = useState<Record<string, CreatorStatus>>({});
  const [dates, setDates] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [showAddModal, setShowAddModal] = useState(false);
  const [addHandle, setAddHandle] = useState("");
  const [addPlatform, setAddPlatform] = useState<"instagram" | "tiktok">("instagram");
  const [addLoading, setAddLoading] = useState(false);

  // Load from localStorage
  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("mve_watchlist_data") || "[]");
    const statusData = JSON.parse(localStorage.getItem("mve_watchlist_status") || "{}");
    const dateData = JSON.parse(localStorage.getItem("mve_watchlist_dates") || "{}");
    setCreators(data);
    setStatuses(statusData);
    setDates(dateData);
  }, []);

  // Poll for WhatsApp-added creators every 5 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/whatsapp");
        if (!res.ok) return;
        const { items } = await res.json();
        if (!items || items.length === 0) return;

        const currentData: WatchlistCreator[] = JSON.parse(localStorage.getItem("mve_watchlist_data") || "[]");
        const currentAdded: string[] = JSON.parse(localStorage.getItem("mve_watchlist_added") || "[]");
        const currentStatuses: Record<string, CreatorStatus> = JSON.parse(localStorage.getItem("mve_watchlist_status") || "{}");
        const currentDates: Record<string, string> = JSON.parse(localStorage.getItem("mve_watchlist_dates") || "{}");

        let changed = false;
        for (const item of items) {
          if (currentAdded.includes(item.username)) continue;
          currentData.push(item);
          currentAdded.push(item.username);
          currentStatuses[item.username] = "watching";
          currentDates[item.username] = item.addedAt || new Date().toISOString();
          changed = true;
        }

        if (changed) {
          localStorage.setItem("mve_watchlist_data", JSON.stringify(currentData));
          localStorage.setItem("mve_watchlist_added", JSON.stringify(currentAdded));
          localStorage.setItem("mve_watchlist_status", JSON.stringify(currentStatuses));
          localStorage.setItem("mve_watchlist_dates", JSON.stringify(currentDates));
          setCreators(currentData);
          setStatuses(currentStatuses);
          setDates(currentDates);
        }
      } catch {
        // silent fail
      }
    };

    const interval = setInterval(poll, 5000);
    poll();
    return () => clearInterval(interval);
  }, []);

  const updateStatus = useCallback(
    (username: string, status: CreatorStatus) => {
      const newStatuses = { ...statuses, [username]: status };
      setStatuses(newStatuses);
      localStorage.setItem("mve_watchlist_status", JSON.stringify(newStatuses));
    },
    [statuses]
  );

  const removeCreator = useCallback(
    (username: string) => {
      const newCreators = creators.filter((c) => c.username !== username);
      setCreators(newCreators);
      localStorage.setItem("mve_watchlist_data", JSON.stringify(newCreators));

      const added = JSON.parse(localStorage.getItem("mve_watchlist_added") || "[]") as string[];
      localStorage.setItem(
        "mve_watchlist_added",
        JSON.stringify(added.filter((u: string) => u !== username))
      );

      const newStatuses = { ...statuses };
      delete newStatuses[username];
      setStatuses(newStatuses);
      localStorage.setItem("mve_watchlist_status", JSON.stringify(newStatuses));
    },
    [creators, statuses]
  );

  const addByHandle = async () => {
    if (!addHandle.trim()) return;
    setAddLoading(true);

    try {
      const handle = addHandle.trim().replace("@", "");

      const res = await fetch("/api/modash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "report",
          platform: addPlatform,
          username: handle,
        }),
      });

      const data = await res.json();

      if (data.error) {
        alert("Could not find that creator. Check the handle and platform.");
        setAddLoading(false);
        return;
      }

      const creator: WatchlistCreator = {
        userId: handle,
        username: data.profile?.username || handle,
        display_name: data.profile?.fullname || handle,
        platform: addPlatform,
        followers: data.profile?.followers || 0,
        engagement_rate: (data.profile?.engagementRate || 0) * 100,
        picture: data.profile?.picture || null,
        isVerified: data.profile?.isVerified || false,
        location: "",
        gender: "",
      };

      const newCreators = [...creators, creator];
      setCreators(newCreators);
      localStorage.setItem("mve_watchlist_data", JSON.stringify(newCreators));

      const added = JSON.parse(localStorage.getItem("mve_watchlist_added") || "[]") as string[];
      added.push(creator.username);
      localStorage.setItem("mve_watchlist_added", JSON.stringify(added));

      const newStatuses = { ...statuses, [creator.username]: "watching" as CreatorStatus };
      setStatuses(newStatuses);
      localStorage.setItem("mve_watchlist_status", JSON.stringify(newStatuses));

      const newDates = { ...dates, [creator.username]: new Date().toISOString() };
      setDates(newDates);
      localStorage.setItem("mve_watchlist_dates", JSON.stringify(newDates));

      setAddHandle("");
      setShowAddModal(false);
    } catch {
      alert("Failed to look up creator. Please try again.");
    } finally {
      setAddLoading(false);
    }
  };

  const filtered =
    filterStatus === "all"
      ? creators
      : creators.filter((c) => statuses[c.username] === filterStatus);

  const counts = STATUSES.reduce(
    (acc, s) => {
      acc[s] = creators.filter((c) => statuses[c.username] === s).length;
      return acc;
    },
    {} as Record<string, number>
  );

  // Group creators by status for kanban
  const grouped = STATUSES.reduce(
    (acc, s) => {
      acc[s] = creators.filter((c) => (statuses[c.username] || "watching") === s);
      return acc;
    },
    {} as Record<CreatorStatus, WatchlistCreator[]>
  );

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const newStatus = destination.droppableId as CreatorStatus;
    updateStatus(draggableId, newStatus);
  };

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Nav />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-ink mb-1">Watchlist</h1>
            <p className="text-ink-secondary text-sm">
              {creators.length} creator{creators.length !== 1 ? "s" : ""} tracked
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center bg-surface rounded-lg border border-edge p-0.5">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "list"
                    ? "bg-ink text-surface"
                    : "text-ink-muted hover:text-ink"
                }`}
                title="List view"
              >
                <List size={16} />
              </button>
              <button
                onClick={() => setViewMode("kanban")}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === "kanban"
                    ? "bg-ink text-surface"
                    : "text-ink-muted hover:text-ink"
                }`}
                title="Kanban view"
              >
                <LayoutGrid size={16} />
              </button>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-ink text-surface rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors"
            >
              <Plus size={16} />
              Add by Handle
            </button>
          </div>
        </div>

        {/* Status Filter Pills — list view only */}
        {viewMode === "list" && (
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <button
              onClick={() => setFilterStatus("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterStatus === "all"
                  ? "bg-ink text-surface"
                  : "bg-surface-tertiary text-ink-secondary hover:text-ink"
              }`}
            >
              All ({creators.length})
            </button>
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-ink text-surface"
                    : `${statusColor(s)} hover:opacity-80`
                }`}
              >
                {statusLabel(s)} ({counts[s] || 0})
              </button>
            ))}
          </div>
        )}

        {/* Empty state */}
        {creators.length === 0 ? (
          <div className="text-center py-20">
            <Users size={48} className="mx-auto text-ink-faint mb-4" />
            <p className="text-ink-secondary text-sm mb-4">
              No creators on your watchlist yet
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                href="/discover"
                className="px-4 py-2 bg-ink text-surface rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors"
              >
                Search Creators
              </Link>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 border border-edge text-ink rounded-lg text-sm font-medium hover:bg-surface-secondary transition-colors"
              >
                Add by Handle
              </button>
            </div>
          </div>
        ) : viewMode === "list" ? (
          /* ── LIST VIEW ── */
          filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-ink-secondary text-sm">
                No creators with status &quot;{statusLabel(filterStatus)}&quot;
              </p>
            </div>
          ) : (
            <div className="bg-surface rounded-xl border border-edge overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-edge bg-surface-secondary">
                    <th className="text-left text-xs font-medium text-ink-secondary px-5 py-3">
                      Creator
                    </th>
                    <th className="text-left text-xs font-medium text-ink-secondary px-5 py-3">
                      Platform
                    </th>
                    <th className="text-left text-xs font-medium text-ink-secondary px-5 py-3">
                      Followers
                    </th>
                    <th className="text-left text-xs font-medium text-ink-secondary px-5 py-3">
                      ER
                    </th>
                    <th className="text-left text-xs font-medium text-ink-secondary px-5 py-3">
                      Status
                    </th>
                    <th className="text-right text-xs font-medium text-ink-secondary px-3 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((creator) => (
                    <tr
                      key={creator.username}
                      className="border-b border-edge last:border-b-0 hover:bg-surface-secondary transition-colors group"
                    >
                      <td className="px-5 py-4">
                        <Link
                          href={`/creators/${encodeURIComponent(creator.username)}?platform=${creator.platform}`}
                          className="flex items-center gap-3 hover:underline"
                        >
                          {creator.picture ? (
                            <img
                              src={creator.picture}
                              alt={creator.username}
                              className="w-9 h-9 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-surface-tertiary flex items-center justify-center">
                              <span className="text-ink-muted text-sm">
                                {creator.username[0]?.toUpperCase()}
                              </span>
                            </div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-ink">
                              {creator.display_name}
                              {creator.isVerified && (
                                <span className="ml-1 text-blue-500">✓</span>
                              )}
                            </p>
                            <p className="text-xs text-ink-muted">
                              @{creator.username}
                            </p>
                          </div>
                        </Link>
                      </td>
                      <td className="px-5 py-4">
                        <PlatformLogo platform={creator.platform} size={18} />
                      </td>
                      <td className="px-5 py-4 text-sm text-ink">
                        {formatNumber(creator.followers)}
                      </td>
                      <td className="px-5 py-4 text-sm text-ink">
                        {formatPercent(creator.engagement_rate)}
                      </td>
                      <td className="px-5 py-4">
                        <div className="relative">
                          <select
                            value={statuses[creator.username] || "watching"}
                            onChange={(e) =>
                              updateStatus(
                                creator.username,
                                e.target.value as CreatorStatus
                              )
                            }
                            className={`px-2.5 py-1 rounded-full text-xs font-medium appearance-none pr-6 border-0 focus:outline-none cursor-pointer ${statusColor(
                              statuses[creator.username] || "watching"
                            )}`}
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {statusLabel(s)}
                              </option>
                            ))}
                          </select>
                          <ChevronDown
                            size={10}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-4 text-right">
                        <button
                          onClick={() => removeCreator(creator.username)}
                          className="p-1.5 rounded-lg text-ink-muted opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                          title="Remove from watchlist"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          /* ── KANBAN VIEW ── */
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
              {STATUSES.map((status) => {
                const accent = STATUS_ACCENT[status];
                const columnCreators = grouped[status];
                return (
                  <div
                    key={status}
                    className={`flex-shrink-0 w-64 rounded-xl border ${accent.border} ${accent.bg} flex flex-col max-h-[calc(100vh-220px)]`}
                  >
                    {/* Column header */}
                    <div className={`px-4 py-3 rounded-t-xl ${accent.header} flex items-center justify-between`}>
                      <span className="text-sm font-semibold">{statusLabel(status)}</span>
                      <span className="text-xs font-medium opacity-70">{columnCreators.length}</span>
                    </div>

                    {/* Droppable area */}
                    <Droppable droppableId={status}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex-1 overflow-y-auto p-2 space-y-2 min-h-[80px] transition-colors ${
                            snapshot.isDraggingOver ? "bg-white/60" : ""
                          }`}
                        >
                          {columnCreators.length === 0 && !snapshot.isDraggingOver && (
                            <p className="text-xs text-ink-muted text-center py-6 opacity-50">
                              No creators
                            </p>
                          )}
                          {columnCreators.map((creator, index) => (
                            <Draggable
                              key={creator.username}
                              draggableId={creator.username}
                              index={index}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`relative bg-white rounded-lg border border-edge p-3 shadow-sm transition-shadow group ${
                                    snapshot.isDragging ? "shadow-lg ring-2 ring-ink/10" : "hover:shadow-md"
                                  }`}
                                >
                                  <Link
                                    href={`/creators/${encodeURIComponent(creator.username)}?platform=${creator.platform}`}
                                    className="block"
                                    onClick={(e) => {
                                      if (snapshot.isDragging) e.preventDefault();
                                    }}
                                  >
                                    <div className="flex items-center gap-2.5 mb-2">
                                      {creator.picture ? (
                                        <img
                                          src={creator.picture}
                                          alt={creator.username}
                                          className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                                          <span className="text-ink-muted text-xs">
                                            {creator.username[0]?.toUpperCase()}
                                          </span>
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-ink truncate">
                                          {creator.display_name}
                                          {creator.isVerified && (
                                            <span className="ml-1 text-blue-500">✓</span>
                                          )}
                                        </p>
                                        <p className="text-xs text-ink-muted truncate">
                                          @{creator.username}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center justify-between text-xs text-ink-secondary">
                                      <div className="flex items-center gap-2">
                                        <PlatformLogo platform={creator.platform} size={14} />
                                        <span>{formatNumber(creator.followers)}</span>
                                      </div>
                                      <span>{formatPercent(creator.engagement_rate)} ER</span>
                                    </div>
                                  </Link>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeCreator(creator.username);
                                    }}
                                    className="absolute top-2 right-2 p-1 rounded text-ink-muted opacity-0 group-hover:opacity-100 hover:text-red-500 hover:bg-red-50 transition-all"
                                    title="Remove"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        )}
      </main>

      {/* Add by Handle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-surface rounded-xl border border-edge p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold text-ink mb-4">
              Add Creator by Handle
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                  Platform
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAddPlatform("instagram")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      addPlatform === "instagram"
                        ? "bg-ink text-surface"
                        : "bg-surface-tertiary text-ink-secondary"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <PlatformLogo platform="instagram" size={16} />
                      Instagram
                    </span>
                  </button>
                  <button
                    onClick={() => setAddPlatform("tiktok")}
                    className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      addPlatform === "tiktok"
                        ? "bg-ink text-surface"
                        : "bg-surface-tertiary text-ink-secondary"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <PlatformLogo platform="tiktok" size={16} />
                      TikTok
                    </span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-secondary mb-1.5">
                  Handle
                </label>
                <input
                  type="text"
                  value={addHandle}
                  onChange={(e) => setAddHandle(e.target.value)}
                  placeholder="@username"
                  className="w-full px-4 py-2.5 rounded-lg border border-edge bg-surface text-ink text-sm placeholder:text-ink-muted focus:outline-none focus:border-ink-muted"
                  onKeyDown={(e) => e.key === "Enter" && addByHandle()}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setAddHandle("");
                }}
                className="px-4 py-2 text-sm font-medium text-ink-secondary hover:text-ink transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={addByHandle}
                disabled={addLoading || !addHandle.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-ink text-surface rounded-lg text-sm font-medium hover:bg-ink/90 disabled:opacity-50 transition-colors"
              >
                {addLoading && <Loader2 size={14} className="animate-spin" />}
                Add to Watchlist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
