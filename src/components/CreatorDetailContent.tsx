"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { getReport, getRawFeed } from "@/lib/modash";
import type {
  WatchlistCreator,
  ReportResponse,
  Note,
  ContentItem,
  Platform,
  SearchResult,
  StatHistoryEntry,
  SponsoredPost,
  Lookalike,
} from "@/lib/types";
import {
  formatNumber,
  formatPercent,
  timeAgo,
  statusLabel,
  statusColor,
} from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  ExternalLink,
  Send,
  Heart,
  MessageCircle,
  Play,
  Share2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Eye,
  Plus,
  Check,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

type Tab = "overview" | "content" | "notes";

interface CreatorDetailContentProps {
  username: string;
  platform: Platform;
  variant: "page" | "panel";
  onClose?: () => void;
  searchResult?: SearchResult;
}

export default function CreatorDetailContent({ username, platform: initialPlatform, variant, searchResult }: CreatorDetailContentProps) {
  const searchParams = useSearchParams();
  const fromParam = variant === "page" ? searchParams.get("from") : null;

  // Basic data from localStorage (shown immediately)
  const [creator, setCreator] = useState<WatchlistCreator | null>(null);
  const [platform, setPlatform] = useState<Platform>(initialPlatform);

  // Report data (loaded async)
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState<string | null>(null);

  // Content tab
  const [content, setContent] = useState<ContentItem[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [contentFetched, setContentFetched] = useState(false);

  // Notes tab
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState("");

  // Active tab
  const [tab, setTab] = useState<Tab>("overview");

  // Load cached creator data from localStorage immediately
  useEffect(() => {
    const data = JSON.parse(
      localStorage.getItem("mve_watchlist_data") || "[]"
    ) as WatchlistCreator[];
    const found = data.find(
      (c) => c.username.toLowerCase() === username.toLowerCase()
    );
    if (found) {
      setCreator(found);
      setPlatform(found.platform);
    }

    // Load notes
    const storedNotes = JSON.parse(
      localStorage.getItem(`mve_notes_${username}`) || "[]"
    );
    setNotes(storedNotes);
  }, [username]);

  // Refreshing state for the button
  const [refreshing, setRefreshing] = useState(false);

  // Fetch report from Modash and cache it
  const fetchReportFromAPI = useCallback(async (plat: Platform, user: string) => {
    try {
      const data = await getReport(plat, user);

      if (data.error) {
        // Try the other platform as fallback
        const otherPlatform = plat === "instagram" ? "tiktok" : "instagram";
        try {
          const fallbackData = await getReport(otherPlatform, user);
          if (!fallbackData.error) {
            // Cache and set
            localStorage.setItem(
              `mve_report_${user}`,
              JSON.stringify({ data: fallbackData, fetchedAt: Date.now() })
            );
            setReport(fallbackData);
            setPlatform(otherPlatform);
            return;
          }
        } catch {
          // Fallback also failed
        }
        setReportError("Could not load report for this creator.");
      } else {
        // Cache and set
        localStorage.setItem(
          `mve_report_${user}`,
          JSON.stringify({ data, fetchedAt: Date.now() })
        );
        setReport(data);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load report";
      if (msg.includes("retry_later") || msg.includes("don't have audience")) {
        setReportError("Modash doesn't have audience data for this creator yet. It's being generated — try again in a couple of hours.");
      } else if (msg.includes("account_removed") || msg.includes("is removed")) {
        setReportError("This account has been removed or is no longer available on the platform.");
      } else if (msg.includes("not_found")) {
        setReportError("Creator not found on this platform. They may have changed their username.");
      } else {
        setReportError(msg);
      }
    }
  }, []);

  // Load report: use cache if available, otherwise fetch
  useEffect(() => {
    let cancelled = false;

    const loadReport = async () => {
      setReportLoading(true);
      setReportError(null);

      // Check localStorage cache
      const cached = localStorage.getItem(`mve_report_${username}`);
      if (cached) {
        try {
          const { data } = JSON.parse(cached);
          if (data && !data.error) {
            setReport(data);
            setReportLoading(false);
            return; // Use cache, don't fetch
          }
        } catch {
          // Bad cache, fetch fresh
        }
      }

      // No cache — fetch from API
      if (!cancelled) {
        await fetchReportFromAPI(platform, username);
      }
      if (!cancelled) setReportLoading(false);
    };

    loadReport();
    return () => { cancelled = true; };
  }, [platform, username, fetchReportFromAPI]);

  // Manual refresh handler
  const handleRefreshReport = useCallback(async () => {
    setRefreshing(true);
    setReportError(null);
    await fetchReportFromAPI(platform, username);
    setRefreshing(false);
  }, [platform, username, fetchReportFromAPI]);

  // Fetch content (on-demand when Content tab is selected)
  const fetchContent = useCallback(async () => {
    if (contentFetched) return;
    setContentLoading(true);
    setContentError(null);

    try {
      const data = await getRawFeed(platform, username);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const r = (data as any).response || data;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawItems: any[] = platform === "tiktok"
        ? r?.user_feed?.items || []
        : r?.items || [];

      // Map raw API fields → ContentItem shape
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const items: ContentItem[] = rawItems.map((item: any) => ({
        id: item.id || item.aweme_id || String(Math.random()),
        type: item.media_type === 2 || item.aweme_type != null ? "video" : "photo",
        thumbnail:
          item.thumbnail ||
          item.image_versions2?.candidates?.[0]?.url ||
          item.video_cover?.url ||
          item.cover?.url_list?.[0] ||
          null,
        text: item.caption?.text || item.desc || "",
        created: item.taken_at || item.create_time,
        likes: item.like_count === -1 ? undefined : (item.like_count ?? item.statistics?.digg_count),
        comments: item.comment_count ?? item.statistics?.comment_count,
        plays: item.play_count ?? item.statistics?.play_count,
        shares: item.reshare_count ?? item.statistics?.share_count,
      }));

      setContent(items.slice(0, 12));
      setContentFetched(true);
    } catch (err) {
      setContentError(
        err instanceof Error ? err.message : "Failed to load content"
      );
    } finally {
      setContentLoading(false);
    }
  }, [platform, username, contentFetched]);

  useEffect(() => {
    if (tab === "content" && !contentFetched) {
      fetchContent();
    }
  }, [tab, contentFetched, fetchContent]);

  // Notes management
  const addNote = () => {
    if (!newNote.trim()) return;
    const note: Note = {
      author: "Dean",
      content: newNote.trim(),
      date: new Date().toISOString(),
    };
    const updated = [note, ...notes];
    setNotes(updated);
    localStorage.setItem(`mve_notes_${username}`, JSON.stringify(updated));
    setNewNote("");
  };

  const deleteNote = (index: number) => {
    const updated = notes.filter((_, i) => i !== index);
    setNotes(updated);
    localStorage.setItem(`mve_notes_${username}`, JSON.stringify(updated));
  };

  // Watchlist state — reactive so UI updates after adding
  const [isOnWatchlist, setIsOnWatchlist] = useState(() => {
    if (typeof window === "undefined") return false;
    const added: string[] = JSON.parse(localStorage.getItem("mve_watchlist_added") || "[]");
    return added.some((u) => u.toLowerCase() === username.toLowerCase());
  });

  const status = (() => {
    if (!isOnWatchlist) return null;
    const statuses = JSON.parse(
      typeof window !== "undefined" ? localStorage.getItem("mve_watchlist_status") || "{}" : "{}"
    );
    return statuses[username] || "watching";
  })();

  const addToWatchlist = () => {
    if (isOnWatchlist) return;
    const p = report?.profile;
    const creatorData = {
      userId: username,
      username,
      display_name: p?.fullname || creator?.display_name || username,
      platform,
      followers: p?.followers || creator?.followers || 0,
      engagement_rate: p?.engagementRate ? p.engagementRate * 100 : (creator?.engagement_rate || 0),
      picture: p?.picture || creator?.picture || null,
      isVerified: p?.isVerified || creator?.isVerified || false,
      location: "",
      gender: "",
    };

    const data = JSON.parse(localStorage.getItem("mve_watchlist_data") || "[]");
    localStorage.setItem("mve_watchlist_data", JSON.stringify([...data, creatorData]));

    const added = JSON.parse(localStorage.getItem("mve_watchlist_added") || "[]");
    localStorage.setItem("mve_watchlist_added", JSON.stringify([...added, username]));

    const statuses = JSON.parse(localStorage.getItem("mve_watchlist_status") || "{}");
    statuses[username] = "watching";
    localStorage.setItem("mve_watchlist_status", JSON.stringify(statuses));

    const dates = JSON.parse(localStorage.getItem("mve_watchlist_dates") || "{}");
    dates[username] = new Date().toISOString();
    localStorage.setItem("mve_watchlist_dates", JSON.stringify(dates));

    setIsOnWatchlist(true);
  };

  const profileUrl =
    platform === "instagram"
      ? `https://instagram.com/${username}`
      : `https://tiktok.com/@${username}`;

  return (
    <div className={variant === "panel" ? "px-6 py-6" : ""}>
      {/* Back button — page variant only */}
      {variant === "page" && (
        <Link
          href={fromParam === "discover" ? "/discover" : "/watchlist"}
          className="inline-flex items-center gap-1.5 text-sm text-ink-secondary hover:text-ink mb-6 transition-colors"
        >
          <ArrowLeft size={16} />
          {fromParam === "discover" ? "Back to Search" : "Back to Watchlist"}
        </Link>
      )}

      {/* Profile Header — shows immediately from localStorage */}
      <div className="bg-surface rounded-xl border border-edge p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          {(creator?.picture || report?.profile?.picture || searchResult?.profile?.picture) ? (
            <img
              src={creator?.picture || report?.profile?.picture || searchResult?.profile?.picture || ""}
              alt={username}
              className="w-20 h-20 rounded-full object-cover"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-surface-tertiary flex items-center justify-center">
              <span className="text-ink-muted text-2xl">
                {username[0]?.toUpperCase()}
              </span>
            </div>
          )}

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-ink">
                {report?.profile?.fullname ||
                  creator?.display_name ||
                  searchResult?.profile?.fullname ||
                  username}
              </h1>
              {(creator?.isVerified || report?.profile?.isVerified || searchResult?.profile?.isVerified) && (
                <span className="text-blue-500">✓</span>
              )}
              <button
                onClick={handleRefreshReport}
                disabled={refreshing}
                className="p-1.5 rounded-md text-ink-muted hover:text-ink hover:bg-surface-secondary transition-colors disabled:opacity-50"
                title="Refresh report"
              >
                <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              </button>
              {status && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor(status)}`}
                >
                  {statusLabel(status)}
                </span>
              )}
            </div>

            <p className="text-ink-secondary text-sm mt-0.5">
              @{username} · {platform === "instagram" ? "📷 Instagram" : "🎵 TikTok"}
            </p>

            {report?.profile?.bio && (
              <p className="text-ink-secondary text-sm mt-2 max-w-lg">
                {report.profile.bio}
              </p>
            )}

            {/* Quick stats */}
            <div className="flex items-center gap-6 mt-4">
              <div>
                <p className="text-lg font-semibold text-ink">
                  {formatNumber(
                    report?.profile?.followers || creator?.followers || searchResult?.profile?.followers
                  )}
                </p>
                <p className="text-xs text-ink-muted">Followers</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-ink">
                  {formatPercent(
                    report?.profile?.engagementRate
                      ? report.profile.engagementRate * 100
                      : creator?.engagement_rate ??
                        (searchResult?.profile?.engagementRate != null
                          ? searchResult.profile.engagementRate * 100
                          : undefined)
                  )}
                </p>
                <p className="text-xs text-ink-muted">Engagement Rate</p>
              </div>
              {report?.profile?.engagements && (
                <div>
                  <p className="text-lg font-semibold text-ink">
                    {formatNumber(report.profile.engagements)}
                  </p>
                  <p className="text-xs text-ink-muted">Avg Engagements</p>
                </div>
              )}
              {report?.stats?.avgReelPlays && (
                <div>
                  <p className="text-lg font-semibold text-ink">
                    {formatNumber(report.stats.avgReelPlays)}
                  </p>
                  <p className="text-xs text-ink-muted">Avg Reel Plays</p>
                </div>
              )}
              {report?.profile?.followersGrowth != null && (
                <div>
                  <p className={`text-lg font-semibold flex items-center gap-1 ${
                    report.profile.followersGrowth > 0
                      ? "text-emerald-600"
                      : report.profile.followersGrowth < 0
                      ? "text-red-500"
                      : "text-ink"
                  }`}>
                    {report.profile.followersGrowth > 0
                      ? <TrendingUp size={16} />
                      : report.profile.followersGrowth < 0
                      ? <TrendingDown size={16} />
                      : null}
                    {report.profile.followersGrowth > 0 ? "+" : ""}
                    {(report.profile.followersGrowth * 100).toFixed(1)}%
                  </p>
                  <p className="text-xs text-ink-muted">Follower Growth</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 flex-shrink-0">
            {!isOnWatchlist ? (
              <button
                onClick={addToWatchlist}
                className="flex items-center gap-1.5 px-3 py-2 bg-ink text-surface rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors"
              >
                <Plus size={14} />
                Add to Watchlist
              </button>
            ) : (
              <span className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium">
                <Check size={14} />
                On Watchlist
              </span>
            )}
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-2 border border-edge rounded-lg text-sm text-ink-secondary hover:text-ink hover:border-edge-strong transition-colors"
            >
              <ExternalLink size={14} />
              View Profile
            </a>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-surface rounded-lg border border-edge p-1 w-fit">
        {(["overview", "content", "notes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t
                ? "bg-surface-tertiary text-ink shadow-sm"
                : "text-ink-secondary hover:text-ink"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (() => {
        // Compute growth chart data
        const history: StatHistoryEntry[] = report?.statHistory || [];
        const sortedHistory = [...history].sort((a, b) => a.month.localeCompare(b.month));
        const netChange = sortedHistory.length >= 2
          ? sortedHistory[sortedHistory.length - 1].followers - sortedHistory[0].followers
          : 0;
        const pctChange = sortedHistory.length >= 2 && sortedHistory[0].followers > 0
          ? ((netChange / sortedHistory[0].followers) * 100)
          : 0;

        // SVG line chart with axes
        const hasLikesData = sortedHistory.some(h => h.avgLikes > 0);
        const n = sortedHistory.length;

        // Chart dimensions inside the SVG viewBox
        const svgW = 600;
        const svgH = 200;
        const marginL = 52;
        const marginR = hasLikesData ? 44 : 12;
        const marginT = 12;
        const marginB = 24;
        const plotW = svgW - marginL - marginR;
        const plotH = svgH - marginT - marginB;

        // Follower scale
        const fData = sortedHistory.map(h => h.followers);
        const fMin = Math.min(...fData);
        const fMax = Math.max(...fData);
        const fPad = (fMax - fMin) * 0.1 || 1000;
        const fScaleMin = fMin - fPad;
        const fScaleMax = fMax + fPad;
        const fRange = fScaleMax - fScaleMin;

        // Likes scale
        const lData = sortedHistory.map(h => h.avgLikes);
        const lMin = Math.min(...lData);
        const lMax = Math.max(...lData);
        const lPad = (lMax - lMin) * 0.1 || 100;
        const lScaleMin = Math.max(0, lMin - lPad);
        const lScaleMax = lMax + lPad;
        const lRange = lScaleMax - lScaleMin;

        const xPos = (i: number) => marginL + (i / (n - 1)) * plotW;
        const yFollower = (v: number) => marginT + (1 - (v - fScaleMin) / fRange) * plotH;
        const yLikes = (v: number) => marginT + (1 - (v - lScaleMin) / lRange) * plotH;

        // Build SVG path strings
        const fLinePath = sortedHistory.map((h, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yFollower(h.followers).toFixed(1)}`).join(" ");
        const fAreaPath = `M${xPos(0).toFixed(1)},${(marginT + plotH).toFixed(1)} ` +
          sortedHistory.map((h, i) => `L${xPos(i).toFixed(1)},${yFollower(h.followers).toFixed(1)}`).join(" ") +
          ` L${xPos(n - 1).toFixed(1)},${(marginT + plotH).toFixed(1)} Z`;
        const lLinePath = hasLikesData
          ? sortedHistory.map((h, i) => `${i === 0 ? "M" : "L"}${xPos(i).toFixed(1)},${yLikes(h.avgLikes).toFixed(1)}`).join(" ")
          : "";

        // Dot positions
        const dots = sortedHistory.map((h, i) => ({
          x: xPos(i), yF: yFollower(h.followers),
          month: h.month, followers: h.followers, avgLikes: h.avgLikes,
        }));

        // Y-axis ticks (3 ticks for followers)
        const fTicks = [fScaleMin, fScaleMin + fRange / 2, fScaleMax].map(v => ({
          y: yFollower(v), label: formatNumber(Math.round(v)),
        }));
        // Y-axis ticks for likes (right side)
        const lTicks = hasLikesData ? [lScaleMin, lScaleMin + lRange / 2, lScaleMax].map(v => ({
          y: yLikes(v), label: formatNumber(Math.round(v)),
        })) : [];

        const hasAudienceData = report && (
          report.audience?.credibility != null ||
          (report.audience?.genders?.length ?? 0) > 0 ||
          (report.audience?.ages?.length ?? 0) > 0 ||
          (report.audience?.geoCountries?.length ?? 0) > 0 ||
          (report.audience?.interests?.length ?? 0) > 0 ||
          (report.audience?.notable?.length ?? 0) > 0
        );

        // === TALENT SIGNAL DETECTION ===
        const signals: { label: string; detail: string; type: "positive" | "negative" | "neutral" }[] = [];

        if (sortedHistory.length >= 3) {
          // 1. Growth acceleration — compare recent 2mo vs earlier months
          const momRates: number[] = [];
          for (let i = 1; i < sortedHistory.length; i++) {
            if (sortedHistory[i - 1].followers > 0) {
              momRates.push(
                (sortedHistory[i].followers - sortedHistory[i - 1].followers) / sortedHistory[i - 1].followers
              );
            }
          }

          if (momRates.length >= 3) {
            const recentRates = momRates.slice(-2);
            const olderRates = momRates.slice(0, -2);
            const avgRecent = recentRates.reduce((a, b) => a + b, 0) / recentRates.length;
            const avgOlder = olderRates.reduce((a, b) => a + b, 0) / olderRates.length;

            if (avgRecent > avgOlder * 1.5 && avgRecent > 0.01) {
              signals.push({
                label: "Accelerating Growth",
                detail: `Recent follower growth (${(avgRecent * 100).toFixed(1)}%/mo) is ${avgOlder > 0 ? (avgRecent / avgOlder).toFixed(1) + "x" : "significantly"} faster than prior trend`,
                type: "positive",
              });
            } else if (avgRecent > 0.02) {
              signals.push({
                label: "Steady Growth",
                detail: `Averaging +${(avgRecent * 100).toFixed(1)}% followers per month recently`,
                type: "positive",
              });
            } else if (avgRecent < -0.01) {
              signals.push({
                label: "Declining Followers",
                detail: `Losing ${(Math.abs(avgRecent) * 100).toFixed(1)}% followers per month recently`,
                type: "negative",
              });
            }

            // 4. Breakout pattern — flat early then sharp recent
            if (sortedHistory.length >= 5) {
              const avgEarlyAbs = olderRates.reduce((a, b) => a + Math.abs(b), 0) / olderRates.length;
              const lastMoM = momRates[momRates.length - 1];
              if (avgEarlyAbs < 0.02 && lastMoM > 0.05) {
                signals.push({
                  label: "Breakout Pattern",
                  detail: `Previously flat growth now showing +${(lastMoM * 100).toFixed(1)}% monthly jump — potential breakout`,
                  type: "positive",
                });
              }
            }
          }

          // 2. Engagement spike — flag if recent avgLikes > 1.5x rolling baseline
          const likesArr = sortedHistory.map(h => h.avgLikes).filter(v => v > 0);
          if (likesArr.length >= 3) {
            const baseline = likesArr.slice(0, -2).reduce((a, b) => a + b, 0) / (likesArr.length - 2);
            const recentPeak = Math.max(likesArr[likesArr.length - 1], likesArr[likesArr.length - 2]);

            if (baseline > 0) {
              const spikeX = recentPeak / baseline;
              if (spikeX >= 2) {
                signals.push({
                  label: "Engagement Spike",
                  detail: `Recent avg likes hit ${formatNumber(recentPeak)} — ${spikeX.toFixed(1)}x their baseline of ${formatNumber(Math.round(baseline))}`,
                  type: "positive",
                });
              } else if (spikeX >= 1.5) {
                signals.push({
                  label: "Engagement Uptick",
                  detail: `Avg likes trending to ${formatNumber(recentPeak)} — ${spikeX.toFixed(1)}x their baseline of ${formatNumber(Math.round(baseline))}`,
                  type: "positive",
                });
              }
            }
          }

          // 3. Engagement-to-follower ratio — high ER for size = early talent
          if (report?.profile?.engagementRate && report.profile.followers) {
            const er = report.profile.engagementRate;
            const f = report.profile.followers;
            if (f < 100000 && er > 0.05) {
              signals.push({
                label: "High Engagement for Size",
                detail: `${(er * 100).toFixed(1)}% ER with ${formatNumber(f)} followers — strong early-stage signal`,
                type: "positive",
              });
            } else if (f < 500000 && er > 0.03) {
              signals.push({
                label: "Above-Average Engagement",
                detail: `${(er * 100).toFixed(1)}% ER at ${formatNumber(f)} followers`,
                type: "positive",
              });
            } else if (er < 0.01 && f > 100000) {
              signals.push({
                label: "Low Engagement Rate",
                detail: `${(er * 100).toFixed(2)}% ER despite ${formatNumber(f)} followers — may indicate inactive or inflated audience`,
                type: "negative",
              });
            }
          }
        }

        // Audience quality signal — use credibility score (Modash's overall quality metric)
        const credibility = report?.audience?.credibility;
        if (credibility != null) {
          if (credibility < 0.5) {
            signals.push({ label: "Low Audience Quality", detail: `Only ${(credibility * 100).toFixed(0)}% audience credibility — proceed with caution`, type: "negative" });
          } else if (credibility > 0.8) {
            signals.push({ label: "High Audience Quality", detail: `${(credibility * 100).toFixed(0)}% audience credibility — authentic audience`, type: "positive" });
          }
        }

        // Paid post performance signal
        if (report?.paidPostPerformance != null) {
          if (report.paidPostPerformance >= 1.2) {
            signals.push({ label: "Strong Sponsored Performance", detail: `Sponsored posts outperform organic by ${((report.paidPostPerformance - 1) * 100).toFixed(0)}% — brand deals won't hurt engagement`, type: "positive" });
          } else if (report.paidPostPerformance < 0.7) {
            signals.push({ label: "Weak Sponsored Performance", detail: `Sponsored posts underperform organic by ${((1 - report.paidPostPerformance) * 100).toFixed(0)}%`, type: "negative" });
          }
        }

        // Overall signal assessment
        const posCount = signals.filter(s => s.type === "positive").length;
        const negCount = signals.filter(s => s.type === "negative").length;
        const hasBreakout = signals.some(s => s.label === "Breakout Pattern" || s.label === "Accelerating Growth");
        const hasSpike = signals.some(s => s.label === "Engagement Spike");

        let overallSignal: "strong" | "promising" | "neutral" | "caution" = "neutral";
        let signalLabel = "Neutral Outlook";
        let signalDesc = "No strong signals in the available data.";

        if (posCount >= 3 && negCount === 0) {
          overallSignal = "strong"; signalLabel = "Strong Talent Signal";
          signalDesc = "Multiple positive indicators — this creator is worth watching closely.";
        } else if ((hasBreakout || hasSpike) && negCount <= 1) {
          overallSignal = "strong"; signalLabel = "Breakout Potential";
          signalDesc = "Recent metrics show accelerating momentum — consider adding to watchlist.";
        } else if (posCount >= 2 && negCount <= 1) {
          overallSignal = "promising"; signalLabel = "Promising Signals";
          signalDesc = "Some positive trends worth monitoring over the coming months.";
        } else if (negCount >= 2) {
          overallSignal = "caution"; signalLabel = "Proceed with Caution";
          signalDesc = "Several concerning metrics — review details below.";
        }

        const signalStyles = {
          strong: { border: "border-emerald-200", bg: "bg-emerald-50", title: "text-emerald-800", desc: "text-emerald-700", dot: "bg-emerald-500" },
          promising: { border: "border-blue-200", bg: "bg-blue-50", title: "text-blue-800", desc: "text-blue-700", dot: "bg-blue-500" },
          neutral: { border: "border-edge", bg: "bg-surface", title: "text-ink", desc: "text-ink-secondary", dot: "bg-ink-muted" },
          caution: { border: "border-red-200", bg: "bg-red-50", title: "text-red-800", desc: "text-red-700", dot: "bg-red-500" },
        };
        const sStyle = signalStyles[overallSignal];

        return (
        <div>
          {/* Talent Signal Callout */}
          {!reportLoading && !reportError && signals.length > 0 && (
            <div className={`rounded-xl border ${sStyle.border} ${sStyle.bg} p-5 mb-4`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${sStyle.dot}`} />
                    <h3 className={`text-sm font-semibold ${sStyle.title}`}>{signalLabel}</h3>
                  </div>
                  <p className={`text-xs mt-1 ${sStyle.desc}`}>{signalDesc}</p>
                </div>
                {!isOnWatchlist && (overallSignal === "strong" || overallSignal === "promising") && (
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${
                    overallSignal === "strong" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {overallSignal === "strong" ? "Consider Watchlisting" : "Worth Monitoring"}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {signals.map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className={`mt-0.5 text-xs ${
                      s.type === "positive" ? "text-emerald-600" : s.type === "negative" ? "text-red-500" : "text-ink-muted"
                    }`}>
                      {s.type === "positive" ? "+" : s.type === "negative" ? "−" : "·"}
                    </span>
                    <div>
                      <span className={`text-xs font-medium ${
                        s.type === "positive" ? "text-emerald-800" : s.type === "negative" ? "text-red-800" : "text-ink-secondary"
                      }`}>{s.label}</span>
                      <span className={`text-xs ml-1.5 ${
                        s.type === "positive" ? "text-emerald-600" : s.type === "negative" ? "text-red-600" : "text-ink-muted"
                      }`}>{s.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Avg Performance */}
          {!reportLoading && !reportError && report?.stats && (
            <div className="bg-surface rounded-xl border border-edge p-5 mb-4">
              <h3 className="text-sm font-medium text-ink-secondary mb-3">Average Performance</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {report.stats.avgLikes != null && (
                  <div>
                    <p className="text-lg font-semibold text-ink">{formatNumber(report.stats.avgLikes)}</p>
                    <p className="text-xs text-ink-muted">Avg Likes</p>
                  </div>
                )}
                {report.stats.avgComments != null && (
                  <div>
                    <p className="text-lg font-semibold text-ink">{formatNumber(report.stats.avgComments)}</p>
                    <p className="text-xs text-ink-muted">Avg Comments</p>
                  </div>
                )}
                {report.stats.avgReelPlays != null && (
                  <div>
                    <p className="text-lg font-semibold text-ink">{formatNumber(report.stats.avgReelPlays)}</p>
                    <p className="text-xs text-ink-muted">Avg Reel Plays</p>
                  </div>
                )}
                {report.stats.avgViews != null && (
                  <div>
                    <p className="text-lg font-semibold text-ink">{formatNumber(report.stats.avgViews)}</p>
                    <p className="text-xs text-ink-muted">Avg Views</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Follower Growth Line Chart */}
          {!reportLoading && !reportError && sortedHistory.length >= 2 && (
            <div className="bg-surface rounded-xl border border-edge p-5 mb-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="text-sm font-medium text-ink-secondary">Growth Trend</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-0.5 bg-ink rounded-full" />
                      <span className="text-[10px] text-ink-muted">Followers</span>
                    </div>
                    {hasLikesData && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-0.5 bg-amber-500 rounded-full" />
                        <span className="text-[10px] text-ink-muted">Avg Likes</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  netChange > 0 ? "text-emerald-600" : netChange < 0 ? "text-red-500" : "text-ink-secondary"
                }`}>
                  {netChange > 0 ? <TrendingUp size={14} /> : netChange < 0 ? <TrendingDown size={14} /> : null}
                  {netChange > 0 ? "+" : ""}{formatNumber(netChange)} ({pctChange > 0 ? "+" : ""}{pctChange.toFixed(1)}%)
                  <span className="text-ink-muted font-normal ml-1">over {sortedHistory.length}mo</span>
                </div>
              </div>
              {/* SVG chart with proper aspect ratio */}
              <div className="relative">
                <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full" style={{ aspectRatio: `${svgW}/${svgH}` }}>
                  {/* Horizontal gridlines */}
                  {fTicks.map((tick, i) => (
                    <line key={`grid-${i}`} x1={marginL} x2={svgW - marginR} y1={tick.y} y2={tick.y} stroke="#e5e5e5" strokeWidth="1" />
                  ))}
                  {/* Y-axis labels — left (followers) */}
                  {fTicks.map((tick, i) => (
                    <text key={`fl-${i}`} x={marginL - 6} y={tick.y + 3.5} textAnchor="end" fontSize="10" fill="#999">{tick.label}</text>
                  ))}
                  {/* Y-axis labels — right (likes) */}
                  {lTicks.map((tick, i) => (
                    <text key={`ll-${i}`} x={svgW - marginR + 6} y={tick.y + 3.5} textAnchor="start" fontSize="10" fill="#d97706">{tick.label}</text>
                  ))}
                  {/* X-axis labels */}
                  {sortedHistory.map((entry, i) => (
                    <text key={entry.month} x={xPos(i)} y={svgH - 4} textAnchor="middle" fontSize="10" fill="#999">
                      {new Date(entry.month + "-01").toLocaleDateString("en-US", { month: "short" })}
                    </text>
                  ))}
                  {/* Follower area fill */}
                  <path d={fAreaPath} fill="rgba(0,0,0,0.03)" />
                  {/* Follower line */}
                  <path d={fLinePath} fill="none" stroke="#1a1a1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  {/* Likes line */}
                  {hasLikesData && (
                    <path d={lLinePath} fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4,3" />
                  )}
                  {/* Dots on follower line */}
                  {dots.map((dot) => (
                    <circle key={dot.month} cx={dot.x} cy={dot.yF} r="3" fill="white" stroke="#1a1a1a" strokeWidth="1.5" />
                  ))}
                </svg>
                {/* Hover zones for tooltips */}
                <div className="absolute inset-0 flex" style={{ left: `${(marginL / svgW) * 100}%`, right: `${(marginR / svgW) * 100}%`, top: `${(marginT / svgH) * 100}%`, bottom: `${(marginB / svgH) * 100}%` }}>
                  {dots.map((dot) => {
                    const monthLabel = new Date(dot.month + "-01").toLocaleDateString("en-US", { month: "short", year: "2-digit" });
                    return (
                      <div key={dot.month} className="flex-1 relative group cursor-crosshair">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-full bg-ink text-surface text-[10px] px-2.5 py-1.5 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-lg">
                          <div className="font-medium">{monthLabel}</div>
                          <div>{formatNumber(dot.followers)} followers</div>
                          {dot.avgLikes > 0 && <div className="text-amber-300">{formatNumber(dot.avgLikes)} avg likes</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {reportLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-ink-muted" />
              <span className="ml-3 text-ink-secondary text-sm">
                Loading audience report...
              </span>
            </div>
          ) : reportError ? (
            <div className="bg-red-50 rounded-xl p-6 text-center">
              <AlertCircle size={24} className="mx-auto text-red-400 mb-2" />
              <p className="text-red-700 text-sm">{reportError}</p>
            </div>
          ) : report && !hasAudienceData ? (
            <div className="bg-surface rounded-xl border border-edge p-8 text-center">
              <p className="text-ink-secondary text-sm font-medium mb-1">No audience data available yet</p>
              <p className="text-ink-muted text-xs max-w-sm mx-auto">
                Modash hasn&apos;t indexed audience analytics for this creator. Try pulling their recent content below, or check back later.
              </p>
              <button
                onClick={() => setTab("content")}
                className="mt-4 px-4 py-2 bg-ink text-surface rounded-lg text-sm font-medium hover:bg-ink/90 transition-colors"
              >
                View Recent Content
              </button>
            </div>
          ) : report ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Credibility */}
              {report.audience?.credibility != null && (
                <div className="bg-surface rounded-xl border border-edge p-5">
                  <h3 className="text-sm font-medium text-ink-secondary mb-3">
                    Audience Credibility
                  </h3>
                  <div className="flex items-end gap-2">
                    <span className="text-3xl font-bold text-ink">
                      {(report.audience.credibility * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs text-ink-muted mb-1">
                      real followers
                    </span>
                  </div>
                  <div className="mt-3 h-2 bg-surface-tertiary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 rounded-full"
                      style={{
                        width: `${report.audience.credibility * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Gender Split */}
              {report.audience?.genders && report.audience.genders.length > 0 && (
                <div className="bg-surface rounded-xl border border-edge p-5">
                  <h3 className="text-sm font-medium text-ink-secondary mb-3">
                    Audience Gender
                  </h3>
                  <div className="space-y-2">
                    {report.audience.genders.map((g) => (
                      <div key={g.code} className="flex items-center gap-3">
                        <span className="text-xs text-ink-secondary w-16 capitalize">
                          {g.code}
                        </span>
                        <div className="flex-1 h-2 bg-surface-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-ink rounded-full"
                            style={{ width: `${g.weight * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-ink w-10 text-right">
                          {(g.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Age Distribution */}
              {report.audience?.ages && report.audience.ages.length > 0 && (
                <div className="bg-surface rounded-xl border border-edge p-5">
                  <h3 className="text-sm font-medium text-ink-secondary mb-3">
                    Audience Age
                  </h3>
                  <div className="space-y-2">
                    {report.audience.ages.map((a) => (
                      <div key={a.code} className="flex items-center gap-3">
                        <span className="text-xs text-ink-secondary w-12">
                          {a.code}
                        </span>
                        <div className="flex-1 h-2 bg-surface-tertiary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-600 rounded-full"
                            style={{ width: `${a.weight * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-ink w-10 text-right">
                          {(a.weight * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top Countries */}
              {report.audience?.geoCountries &&
                report.audience.geoCountries.length > 0 && (
                  <div className="bg-surface rounded-xl border border-edge p-5">
                    <h3 className="text-sm font-medium text-ink-secondary mb-3">
                      Top Countries
                    </h3>
                    <div className="space-y-2">
                      {report.audience.geoCountries.slice(0, 5).map((c) => (
                        <div
                          key={c.code}
                          className="flex items-center gap-3"
                        >
                          <span className="text-xs text-ink-secondary w-24 truncate">
                            {c.name}
                          </span>
                          <div className="flex-1 h-2 bg-surface-tertiary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full"
                              style={{ width: `${c.weight * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-ink w-10 text-right">
                            {(c.weight * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Top Cities */}
              {report.audience?.geoCities &&
                report.audience.geoCities.length > 0 && (
                  <div className="bg-surface rounded-xl border border-edge p-5">
                    <h3 className="text-sm font-medium text-ink-secondary mb-3">
                      Top Cities
                    </h3>
                    <div className="space-y-2">
                      {report.audience.geoCities.slice(0, 5).map((c) => (
                        <div
                          key={c.code}
                          className="flex items-center gap-3"
                        >
                          <span className="text-xs text-ink-secondary w-24 truncate">
                            {c.name}
                          </span>
                          <div className="flex-1 h-2 bg-surface-tertiary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-purple-500 rounded-full"
                              style={{ width: `${c.weight * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-ink w-10 text-right">
                            {(c.weight * 100).toFixed(1)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Interests */}
              {report.audience?.interests &&
                report.audience.interests.length > 0 && (
                  <div className="bg-surface rounded-xl border border-edge p-5">
                    <h3 className="text-sm font-medium text-ink-secondary mb-3">
                      Audience Interests
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {report.audience.interests.slice(0, 10).map((i) => (
                        <span
                          key={i.name}
                          className="px-2.5 py-1 bg-surface-tertiary rounded-full text-xs text-ink-secondary"
                        >
                          {i.name}{" "}
                          <span className="text-ink-muted">
                            {(i.weight * 100).toFixed(0)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Notable Followers */}
              {report.audience?.notable &&
                report.audience.notable.length > 0 && (
                  <div className="bg-surface rounded-xl border border-edge p-5 md:col-span-2">
                    <h3 className="text-sm font-medium text-ink-secondary mb-3">
                      Notable Followers
                    </h3>
                    <div className="flex flex-wrap gap-3">
                      {report.audience.notable.slice(0, 8).map((n) => (
                        <div
                          key={n.userId}
                          className="flex items-center gap-2 bg-surface-secondary rounded-lg px-3 py-2"
                        >
                          {n.picture ? (
                            <img
                              src={n.picture}
                              alt={n.username}
                              className="w-7 h-7 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-7 h-7 rounded-full bg-surface-tertiary" />
                          )}
                          <div>
                            <p className="text-xs font-medium text-ink">
                              {n.fullname || n.username}
                            </p>
                            <p className="text-[10px] text-ink-muted">
                              @{n.username}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

            </div>
          ) : null}

          {/* === NEW ENRICHED DATA SECTIONS === */}

          {/* 1. Paid Post Performance — key metric for talent managers */}
          {!reportLoading && !reportError && report?.paidPostPerformance != null && (
            <div className="bg-surface rounded-xl border border-edge p-5 mt-4">
              <h3 className="text-sm font-medium text-ink-secondary mb-3 flex items-center gap-2">
                <DollarSign size={14} />
                Sponsored vs Organic Performance
              </h3>
              <div className="flex items-end gap-3">
                <span className={`text-3xl font-bold ${
                  report.paidPostPerformance >= 1 ? "text-emerald-600" : "text-red-500"
                }`}>
                  {report.paidPostPerformance.toFixed(2)}x
                </span>
                <span className="text-sm text-ink-secondary mb-1">
                  {report.paidPostPerformance >= 1
                    ? `Sponsored posts perform ${((report.paidPostPerformance - 1) * 100).toFixed(0)}% better than organic`
                    : `Sponsored posts perform ${((1 - report.paidPostPerformance) * 100).toFixed(0)}% worse than organic`
                  }
                </span>
              </div>
            </div>
          )}

          {/* 2. Reels Performance — separate reels stats */}
          {!reportLoading && !reportError && report?.reelsStats && (
            <div className="bg-surface rounded-xl border border-edge p-5 mt-4">
              <h3 className="text-sm font-medium text-ink-secondary mb-3 flex items-center gap-2">
                <Play size={14} />
                Reels Performance
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {report.reelsStats.avgReelsPlays != null && (
                  <div>
                    <p className="text-lg font-semibold text-ink">{formatNumber(report.reelsStats.avgReelsPlays)}</p>
                    <p className="text-xs text-ink-muted">Avg Plays</p>
                  </div>
                )}
                {report.reelsStats.avgLikes != null && (
                  <div>
                    <p className="text-lg font-semibold text-ink">{formatNumber(report.reelsStats.avgLikes)}</p>
                    <p className="text-xs text-ink-muted">Avg Likes</p>
                  </div>
                )}
                {report.reelsStats.avgComments != null && (
                  <div>
                    <p className="text-lg font-semibold text-ink">{formatNumber(report.reelsStats.avgComments)}</p>
                    <p className="text-xs text-ink-muted">Avg Comments</p>
                  </div>
                )}
                {report.reelsStats.engagementRate != null && (
                  <div>
                    <p className="text-lg font-semibold text-ink">{(report.reelsStats.engagementRate * 100).toFixed(2)}%</p>
                    <p className="text-xs text-ink-muted">Reels ER</p>
                  </div>
                )}
                {report.reelsStats.avgShares != null && (
                  <div>
                    <p className="text-lg font-semibold text-ink">{formatNumber(report.reelsStats.avgShares)}</p>
                    <p className="text-xs text-ink-muted">Avg Shares</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 3. Audience Quality Breakdown */}
          {!reportLoading && !reportError && report?.audienceTypes && report.audienceTypes.length > 0 && (
            <div className="bg-surface rounded-xl border border-edge p-5 mt-4">
              <h3 className="text-sm font-medium text-ink-secondary mb-3 flex items-center gap-2">
                <Eye size={14} />
                Audience Quality Breakdown
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {report.audienceTypes.map((t) => {
                  const labels: Record<string, string> = {
                    real: "Real People",
                    suspicious: "Suspicious",
                    mass_followers: "Mass Followers",
                    influencers: "Influencers",
                  };
                  const colors: Record<string, string> = {
                    real: "text-emerald-600",
                    suspicious: "text-red-500",
                    mass_followers: "text-amber-600",
                    influencers: "text-blue-600",
                  };
                  return (
                    <div key={t.code}>
                      <p className={`text-lg font-semibold ${colors[t.code] || "text-ink"}`}>
                        {(t.weight * 100).toFixed(1)}%
                      </p>
                      <p className="text-xs text-ink-muted">{labels[t.code] || t.code}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 4. Brand Affinity — creator + audience side by side */}
          {!reportLoading && !reportError && (
            (report?.creatorBrandAffinity?.length ?? 0) > 0 || (report?.audienceBrandAffinity?.length ?? 0) > 0
          ) && (
            <div className="bg-surface rounded-xl border border-edge p-5 mt-4">
              <h3 className="text-sm font-medium text-ink-secondary mb-3">Brand Affinity</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {report!.creatorBrandAffinity && report!.creatorBrandAffinity.length > 0 && (
                  <div>
                    <p className="text-xs text-ink-muted mb-2 font-medium uppercase tracking-wide">Creator Mentions</p>
                    <div className="flex flex-wrap gap-2">
                      {report!.creatorBrandAffinity.slice(0, 12).map((b) => (
                        <span key={b.name} className="px-2.5 py-1 bg-surface-tertiary rounded-full text-xs text-ink-secondary">
                          {b.name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {report!.audienceBrandAffinity && report!.audienceBrandAffinity.length > 0 && (
                  <div>
                    <p className="text-xs text-ink-muted mb-2 font-medium uppercase tracking-wide">Audience Follows</p>
                    <div className="flex flex-wrap gap-2">
                      {report!.audienceBrandAffinity.slice(0, 12).map((b) => (
                        <span key={b.name} className="px-2.5 py-1 bg-blue-50 rounded-full text-xs text-blue-700">
                          {b.name} {b.weight != null && <span className="text-blue-400">{(b.weight * 100).toFixed(0)}%</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. Sponsored Posts — brand deal history */}
          {!reportLoading && !reportError && report?.sponsoredPosts && report.sponsoredPosts.length > 0 && (
            <div className="bg-surface rounded-xl border border-edge p-5 mt-4">
              <h3 className="text-sm font-medium text-ink-secondary mb-3 flex items-center gap-2">
                <DollarSign size={14} />
                Recent Brand Deals ({report.sponsoredPosts.length})
              </h3>
              <div className="space-y-3">
                {report.sponsoredPosts.slice(0, 6).map((sp: SponsoredPost) => (
                  <div key={sp.id} className="flex items-start gap-3 p-3 bg-surface-secondary rounded-lg">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {sp.sponsors.map((s) => (
                          <span key={s.name} className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-amber-50 rounded text-xs font-medium text-amber-800">
                            {s.logo_url && <img src={s.logo_url} alt="" className="w-3.5 h-3.5 rounded-sm object-contain" />}
                            {s.name}
                          </span>
                        ))}
                      </div>
                      {sp.text && <p className="text-xs text-ink-secondary line-clamp-2">{sp.text}</p>}
                      <div className="flex items-center gap-3 mt-1.5 text-ink-muted">
                        {sp.likes != null && <span className="flex items-center gap-1 text-xs"><Heart size={10} />{formatNumber(sp.likes)}</span>}
                        {sp.comments != null && <span className="flex items-center gap-1 text-xs"><MessageCircle size={10} />{formatNumber(sp.comments)}</span>}
                        {sp.plays != null && <span className="flex items-center gap-1 text-xs"><Play size={10} />{formatNumber(sp.plays)}</span>}
                        {sp.created && <span className="text-xs ml-auto">{timeAgo(sp.created)}</span>}
                      </div>
                    </div>
                    {sp.url && (
                      <a href={sp.url} target="_blank" rel="noopener noreferrer" className="text-ink-muted hover:text-ink flex-shrink-0">
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 6. Popular Posts — top performing content */}
          {!reportLoading && !reportError && report?.popularPosts && report.popularPosts.length > 0 && (
            <div className="bg-surface rounded-xl border border-edge p-5 mt-4">
              <h3 className="text-sm font-medium text-ink-secondary mb-3">Top Performing Posts</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {report.popularPosts.slice(0, 10).map((post) => (
                  <a
                    key={post.id}
                    href={post.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group block"
                  >
                    <div className="aspect-square bg-surface-tertiary rounded-lg overflow-hidden relative">
                      {post.thumbnail ? (
                        <img src={post.thumbnail} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-ink-muted text-xs">No preview</div>
                      )}
                      {post.plays != null && (
                        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-black/60 text-white px-1.5 py-0.5 rounded text-[10px]">
                          <Play size={8} fill="white" />{formatNumber(post.plays)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 text-ink-muted text-[10px]">
                      {post.likes != null && <span className="flex items-center gap-0.5"><Heart size={8} />{formatNumber(post.likes)}</span>}
                      {post.comments != null && <span className="flex items-center gap-0.5"><MessageCircle size={8} />{formatNumber(post.comments)}</span>}
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 7. Lookalike Creators — similar creators for scouting */}
          {!reportLoading && !reportError && report?.lookalikes && report.lookalikes.length > 0 && (
            <div className="bg-surface rounded-xl border border-edge p-5 mt-4">
              <h3 className="text-sm font-medium text-ink-secondary mb-3">Similar Creators ({report.lookalikes.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {report.lookalikes.slice(0, 10).map((l: Lookalike) => (
                  <a
                    key={l.userId}
                    href={`/creators/${encodeURIComponent(l.username)}?platform=${platform}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-secondary transition-colors cursor-pointer"
                  >
                    {l.picture ? (
                      <img src={l.picture} alt={l.username} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface-tertiary flex items-center justify-center flex-shrink-0">
                        <span className="text-ink-muted text-sm">{l.username?.[0]?.toUpperCase()}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink truncate">
                        {l.fullname || l.username}
                        {l.isVerified && <span className="ml-1 text-blue-500 text-xs">✓</span>}
                      </p>
                      <p className="text-xs text-ink-muted">@{l.username}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xs font-medium text-ink">{formatNumber(l.followers)}</p>
                      <p className="text-[10px] text-ink-muted">followers</p>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>
        );
      })()}

      {tab === "content" && (
        <div>
          {contentLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={24} className="animate-spin text-ink-muted" />
              <span className="ml-3 text-ink-secondary text-sm">
                Pulling recent content (costs 1 credit)...
              </span>
            </div>
          ) : contentError ? (
            <div className="bg-red-50 rounded-xl p-6 text-center">
              <AlertCircle size={24} className="mx-auto text-red-400 mb-2" />
              <p className="text-red-700 text-sm mb-3">{contentError}</p>
              <button
                onClick={() => {
                  setContentFetched(false);
                  setContentError(null);
                }}
                className="px-4 py-2 bg-red-100 rounded-lg text-sm font-medium text-red-700 hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          ) : content.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-ink-secondary text-sm">
                No recent content found.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {content.map((item, idx) => {
                const thumbnail =
                  item.thumbnail ||
                  item.image_versions?.items?.[0]?.url ||
                  item.video_versions?.[0]?.url ||
                  null;
                const likes =
                  item.likes != null && item.likes !== -1
                    ? item.likes
                    : null;

                return (
                  <div
                    key={item.id || idx}
                    className="bg-surface rounded-xl border border-edge overflow-hidden"
                  >
                    {thumbnail ? (
                      <div className="aspect-square bg-surface-tertiary relative">
                        <img
                          src={thumbnail}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {item.plays != null && (
                          <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/60 text-white px-2 py-0.5 rounded text-xs">
                            <Play size={10} fill="white" />
                            {formatNumber(item.plays)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-square bg-surface-tertiary flex items-center justify-center">
                        <span className="text-ink-muted text-xs">
                          No preview
                        </span>
                      </div>
                    )}
                    <div className="p-3">
                      {item.text && (
                        <p className="text-xs text-ink-secondary line-clamp-2 mb-2">
                          {item.text}
                        </p>
                      )}
                      <div className="flex items-center gap-3 text-ink-muted">
                        {likes != null && (
                          <span className="flex items-center gap-1 text-xs">
                            <Heart size={10} />
                            {formatNumber(likes)}
                          </span>
                        )}
                        {item.comments != null && (
                          <span className="flex items-center gap-1 text-xs">
                            <MessageCircle size={10} />
                            {formatNumber(item.comments)}
                          </span>
                        )}
                        {item.shares != null && (
                          <span className="flex items-center gap-1 text-xs">
                            <Share2 size={10} />
                            {formatNumber(item.shares)}
                          </span>
                        )}
                        {item.created && (
                          <span className="text-xs ml-auto">
                            {timeAgo(item.created)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {tab === "notes" && (
        <div>
          {/* Add note */}
          <div className="bg-surface rounded-xl border border-edge p-5 mb-4">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Add a note about this creator..."
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-edge bg-surface text-ink text-sm placeholder:text-ink-muted resize-none focus:outline-none focus:border-ink-muted"
            />
            <div className="flex justify-end mt-3">
              <button
                onClick={addNote}
                disabled={!newNote.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-ink text-surface rounded-lg text-sm font-medium hover:bg-ink/90 disabled:opacity-50 transition-colors"
              >
                <Send size={14} />
                Add Note
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notes.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-ink-secondary text-sm">
                No notes yet. Add one above.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map((note, idx) => (
                <div
                  key={idx}
                  className="bg-surface rounded-xl border border-edge p-4 group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-ink">
                        {note.author}
                      </span>
                      <span className="text-xs text-ink-muted">
                        {timeAgo(note.date)}
                      </span>
                    </div>
                    <button
                      onClick={() => deleteNote(idx)}
                      className="text-xs text-ink-muted hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-sm text-ink-secondary whitespace-pre-wrap">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
