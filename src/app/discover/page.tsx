"use client";

import { useState, useCallback } from "react";
import Nav from "@/components/Nav";
import FilterPanel, { ER_OPTIONS, FOLLOWER_OPTIONS, type PlatformOption, type LocationValue, type TopicValue, type AudienceGeoValue } from "@/components/discover/FilterPanel";
import LocationSearch from "@/components/discover/LocationSearch";
import CreatorCard from "@/components/discover/CreatorCard";
import SlidePanel from "@/components/SlidePanel";
import CreatorDetailContent from "@/components/CreatorDetailContent";
import { searchCreators, aiSearch, lookupTopicTag, type SearchFilters } from "@/lib/modash";
import type { SearchResult, WatchlistCreator, Platform } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { Search, Loader2, ChevronDown, SlidersHorizontal } from "lucide-react";

type SearchMode = "ai" | "filters";

export default function DiscoverPage() {
  const [mode, setMode] = useState<SearchMode>("filters");
  const [aiQuery, setAiQuery] = useState("");

  // Filter state
  const [platformOption, setPlatformOption] = useState<PlatformOption>("instagram");
  const [niche, setNiche] = useState("");
  const [topic, setTopic] = useState<TopicValue | null>(null);
  const [gender, setGender] = useState("");
  const [followerMin, setFollowerMin] = useState(0);
  const [followerMax, setFollowerMax] = useState(0);
  const [erMinIndex, setErMinIndex] = useState(0);
  const [location, setLocation] = useState<LocationValue | null>(null);
  const [audienceGeo, setAudienceGeo] = useState<AudienceGeoValue | null>(null);

  // Results state
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showAiFilters, setShowAiFilters] = useState(false);
  const [erFilteredAll, setErFilteredAll] = useState(false);
  const [panelCreator, setPanelCreator] = useState<{ username: string; platform: Platform; result: SearchResult } | null>(null);

  const [addedUsernames, setAddedUsernames] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const stored = localStorage.getItem("mve_watchlist_added");
      return new Set(stored ? JSON.parse(stored) : []);
    } catch {
      return new Set();
    }
  });

  const buildFilters = useCallback((platform: Platform, resolvedNicheTag?: string): SearchFilters => {
    const influencer: Record<string, unknown> = {};
    if (followerMin > 0 || followerMax > 0) {
      influencer.followers = {
        ...(followerMin > 0 ? { min: followerMin } : {}),
        ...(followerMax > 0 ? { max: followerMax } : {}),
      };
    }
    if (gender) influencer.gender = gender;
    // Topic (precise autocomplete) takes precedence over niche dropdown; both use relevance
    // Note: for TikTok, niche tags may differ — resolvedNicheTag overrides when provided
    if (topic) {
      influencer.relevance = [`#${topic.tag}`];
    } else if (resolvedNicheTag) {
      influencer.relevance = [`#${resolvedNicheTag}`];
    } else if (niche) {
      influencer.relevance = [`#${niche}`];
    }
    if (location) influencer.location = [Number(location.id)];
    const erOption = ER_OPTIONS[erMinIndex];
    if (erOption.value !== undefined) {
      influencer.engagementRate = erOption.value;
    }

    const audience: Record<string, unknown> = {};
    if (audienceGeo) {
      audience.geo = [{ id: Number(audienceGeo.location.id), weight: audienceGeo.weight }];
    }

    const filters: SearchFilters = {
      platform,
      influencer,
      audience: Object.keys(audience).length > 0 ? audience : undefined,
      sort: { field: "followers", direction: "desc" },
    };
    return filters;
  }, [followerMin, followerMax, gender, niche, topic, location, erMinIndex, audienceGeo]);

  // ER applied client-side (Modash search doesn't support it reliably)
  const applyClientFilters = (raw: SearchResult[]): SearchResult[] => {
    const erOption = ER_OPTIONS[erMinIndex];
    if (erOption.value === undefined) return raw;
    return raw.filter((r) => r.profile.engagementRate >= erOption.value!);
  };

  const doSearch = async (isAI: boolean, loadMore = false) => {
    const page = loadMore ? currentPage + 1 : 0;

    if (loadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setHasSearched(true);
      setCurrentPage(0);
      setErFilteredAll(false);
    }
    setError(null);

    // For TikTok niche searches, resolve the tag via Modash topics endpoint
    // (Instagram tags like "beauty" often don't exist on TikTok — need e.g. "beautytips")
    let ttNicheTag: string | undefined;
    if (!isAI && niche && !topic) {
      const needsTT = platformOption === "tiktok" || platformOption === "both";
      if (needsTT) {
        ttNicheTag = (await lookupTopicTag(niche, "tiktok")) ?? undefined;
      }
    }

    try {
      if (isAI) {
        // Use Modash AI Search API (real content-based search)
        const aiFilters: { followersCount?: { min?: number; max?: number }; gender?: string; engagementRate?: number } = {};
        if (followerMin > 0 || followerMax > 0) {
          aiFilters.followersCount = {
            ...(followerMin > 0 ? { min: followerMin } : {}),
            ...(followerMax > 0 ? { max: followerMax } : {}),
          };
        }
        if (gender) aiFilters.gender = gender;
        const erOpt = ER_OPTIONS[erMinIndex];
        if (erOpt.value !== undefined) aiFilters.engagementRate = erOpt.value;

        const platforms: Array<"instagram" | "tiktok"> = platformOption === "both" ? ["instagram", "tiktok"] : [platformOption];
        const searchResults = await Promise.all(
          platforms.map((p) => aiSearch(p, aiQuery, aiFilters, page).catch(() => null))
        );
        const combined: SearchResult[] = [];
        let totalCount = 0;
        for (let idx = 0; idx < searchResults.length; idx++) {
          const d = searchResults[idx];
          if (d && !d.error) {
            const tagged = (d.lookalikes || []).map(r => ({ ...r, _platform: platforms[idx] as Platform }));
            combined.push(...tagged);
            totalCount += d.total || 0;
          }
        }
        combined.sort((a, b) => b.profile.followers - a.profile.followers);
        // Client-side follower filtering (AI API doesn't always enforce it)
        let aiFiltered = combined;
        if (followerMin > 0) aiFiltered = aiFiltered.filter(r => r.profile.followers >= followerMin);
        if (followerMax > 0) aiFiltered = aiFiltered.filter(r => r.profile.followers <= followerMax);
        const afterFollower = aiFiltered;
        if (erOpt.value !== undefined) {
          aiFiltered = aiFiltered.filter(r => r.profile.engagementRate >= erOpt.value!);
        }
        if (!loadMore) setErFilteredAll(afterFollower.length > 0 && aiFiltered.length === 0 && erMinIndex > 0);
        setResults(loadMore ? (prev) => [...prev, ...aiFiltered] : aiFiltered);
        setTotal(totalCount);
        setCurrentPage(page);
        const didErFilterAll = afterFollower.length > 0 && aiFiltered.length === 0 && erMinIndex > 0;
        if (!loadMore && aiFiltered.length === 0 && !didErFilterAll) setError("No results found. Try a different description.");
      } else {
        if (platformOption === "both") {
          const [igData, ttData] = await Promise.all([
            searchCreators(buildFilters("instagram"), page).catch(() => null),
            searchCreators(buildFilters("tiktok", ttNicheTag), page).catch(() => null),
          ]);
          const combined: SearchResult[] = [];
          if (igData && !igData.error) combined.push(...(igData.lookalikes || []).map(r => ({ ...r, _platform: "instagram" as const })));
          if (ttData && !ttData.error) combined.push(...(ttData.lookalikes || []).map(r => ({ ...r, _platform: "tiktok" as const })));
          combined.sort((a, b) => b.profile.followers - a.profile.followers);
          const filtered = applyClientFilters(combined);
          if (!loadMore) setErFilteredAll(combined.length > 0 && filtered.length === 0 && erMinIndex > 0);
          setResults(loadMore ? (prev) => [...prev, ...filtered] : filtered);
          setTotal((igData?.total || 0) + (ttData?.total || 0));
          setCurrentPage(page);
          if (!loadMore && combined.length === 0) setError("No results from either platform.");
        } else {
          const resolvedTag = platformOption === "tiktok" ? ttNicheTag : undefined;
          const data = await searchCreators(buildFilters(platformOption, resolvedTag), page);
          if (data.error) {
            setError("Search returned an error. Try adjusting your filters.");
            if (!loadMore) { setResults([]); setTotal(0); }
          } else {
            const raw = data.lookalikes || [];
            const filtered = applyClientFilters(raw);
            if (!loadMore) setErFilteredAll(raw.length > 0 && filtered.length === 0 && erMinIndex > 0);
            setResults(loadMore ? (prev) => [...prev, ...filtered] : filtered);
            setTotal(data.total || 0);
            setCurrentPage(page);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
      if (!loadMore) { setResults([]); setTotal(0); }
    } finally {
      if (loadMore) setLoadingMore(false);
      else setLoading(false);
    }
  };

  const handleClear = () => {
    setPlatformOption("instagram");
    setNiche("");
    setTopic(null);
    setGender("");
    setFollowerMin(0);
    setFollowerMax(0);
    setErMinIndex(0);
    setLocation(null);
    setAudienceGeo(null);
    setResults([]);
    setTotal(0);
    setHasSearched(false);
    setCurrentPage(0);
    setErFilteredAll(false);
  };

  const addToWatchlist = (result: SearchResult, resultPlatform: Platform) => {
    const creator: WatchlistCreator = {
      userId: result.userId,
      username: result.profile.username,
      display_name: result.profile.fullname || result.profile.username,
      platform: resultPlatform,
      followers: result.profile.followers,
      engagement_rate: result.profile.engagementRate * 100,
      picture: result.profile.picture || null,
      isVerified: result.profile.isVerified,
      location: [result.match?.influencer?.geo?.city?.name, result.match?.influencer?.geo?.country?.name]
        .filter(Boolean)
        .join(", "),
      gender: result.match?.influencer?.gender || "",
    };

    const data = JSON.parse(localStorage.getItem("mve_watchlist_data") || "[]") as WatchlistCreator[];
    localStorage.setItem("mve_watchlist_data", JSON.stringify([...data, creator]));

    const added = JSON.parse(localStorage.getItem("mve_watchlist_added") || "[]") as string[];
    localStorage.setItem("mve_watchlist_added", JSON.stringify([...added, creator.username]));

    const statuses = JSON.parse(localStorage.getItem("mve_watchlist_status") || "{}");
    statuses[creator.username] = "watching";
    localStorage.setItem("mve_watchlist_status", JSON.stringify(statuses));

    const dates = JSON.parse(localStorage.getItem("mve_watchlist_dates") || "{}");
    dates[creator.username] = new Date().toISOString();
    localStorage.setItem("mve_watchlist_dates", JSON.stringify(dates));

    setAddedUsernames((prev) => { const s = new Set(Array.from(prev)); s.add(creator.username); return s; });
  };

  const getResultPlatform = (result: SearchResult): Platform => {
    if (platformOption !== "both") return platformOption;
    return result._platform || "instagram";
  };

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Nav />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-ink mb-1">Discover Creators</h1>
          <p className="text-ink-secondary text-sm">Search Instagram and TikTok creators using Modash</p>
        </div>

        <div className="bg-surface rounded-xl border border-edge p-6 mb-8">
          {/* Mode Toggle */}
          <div className="flex items-center gap-1 mb-6 bg-surface-tertiary rounded-lg p-1 w-fit">
            <button
              onClick={() => setMode("filters")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === "filters" ? "bg-surface text-ink shadow-sm" : "text-ink-secondary hover:text-ink"}`}
            >
              Filters
            </button>
            <button
              onClick={() => setMode("ai")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${mode === "ai" ? "bg-surface text-ink shadow-sm" : "text-ink-secondary hover:text-ink"}`}
            >
              AI Search
            </button>
          </div>

          {mode === "ai" ? (
            <div>
              <div className="flex gap-3 mb-3">
                <input
                  type="text"
                  value={aiQuery}
                  onChange={(e) => setAiQuery(e.target.value)}
                  placeholder='e.g. "fitness influencer in London"'
                  className="flex-1 px-4 py-3 rounded-lg border border-edge bg-surface text-ink placeholder:text-ink-muted text-sm focus:outline-none focus:border-ink-muted"
                  onKeyDown={(e) => e.key === "Enter" && doSearch(true)}
                />
                <button
                  onClick={() => doSearch(true)}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-3 bg-ink text-surface rounded-lg text-sm font-medium hover:bg-ink/90 disabled:opacity-50 transition-colors"
                >
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                  Search
                </button>
              </div>

              {/* Expandable filters */}
              <button
                onClick={() => setShowAiFilters((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-ink-secondary hover:text-ink transition-colors mb-3"
              >
                <SlidersHorizontal size={12} />
                {showAiFilters ? "Hide filters" : "Add filters"}
                <ChevronDown size={12} className={`transition-transform ${showAiFilters ? "rotate-180" : ""}`} />
              </button>

              {showAiFilters && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-edge">
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1.5">Platform</label>
                    <select value={platformOption} onChange={(e) => setPlatformOption(e.target.value as PlatformOption)} className="w-full px-3 py-2 rounded-lg border border-edge bg-surface text-ink text-xs appearance-none focus:outline-none focus:border-ink-muted">
                      <option value="instagram">Instagram</option>
                      <option value="tiktok">TikTok</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1.5">Min Followers</label>
                    <select value={followerMin} onChange={(e) => setFollowerMin(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-edge bg-surface text-ink text-xs appearance-none focus:outline-none focus:border-ink-muted">
                      {FOLLOWER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.value === 0 ? "Any" : o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1.5">Max Followers</label>
                    <select value={followerMax} onChange={(e) => setFollowerMax(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-edge bg-surface text-ink text-xs appearance-none focus:outline-none focus:border-ink-muted">
                      <option value={0}>No max</option>
                      {FOLLOWER_OPTIONS.filter((o) => o.value > 0).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1.5">Creator Gender</label>
                    <select value={gender} onChange={(e) => setGender(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-edge bg-surface text-ink text-xs appearance-none focus:outline-none focus:border-ink-muted">
                      <option value="">Any</option>
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1.5">Min Engagement Rate</label>
                    <select value={erMinIndex} onChange={(e) => setErMinIndex(Number(e.target.value))} className="w-full px-3 py-2 rounded-lg border border-edge bg-surface text-ink text-xs appearance-none focus:outline-none focus:border-ink-muted">
                      {ER_OPTIONS.map((opt, i) => <option key={i} value={i}>{opt.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-ink-secondary mb-1.5">Location</label>
                    <LocationSearch platform={platformOption} value={location} onChange={setLocation} compact />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <FilterPanel
              platform={platformOption}
              setPlatform={setPlatformOption}
              niche={niche}
              setNiche={setNiche}
              topic={topic}
              setTopic={setTopic}
              gender={gender}
              setGender={setGender}
              followerMin={followerMin}
              setFollowerMin={setFollowerMin}
              followerMax={followerMax}
              setFollowerMax={setFollowerMax}
              erMinIndex={erMinIndex}
              setErMinIndex={setErMinIndex}
              location={location}
              setLocation={setLocation}
              audienceGeo={audienceGeo}
              setAudienceGeo={setAudienceGeo}
              loading={loading}
              onSearch={() => doSearch(false)}
              onClear={handleClear}
            />
          )}
        </div>

        {/* Results */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-ink-muted" />
            <span className="ml-3 text-ink-secondary text-sm">
              {platformOption === "both" ? "Searching Instagram & TikTok..." : "Searching creators..."}
            </span>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 text-red-700 rounded-xl p-6 text-center">
            <p className="font-medium mb-2">Something went wrong</p>
            <p className="text-sm">{error}</p>
            <button onClick={() => doSearch(mode === "ai")} className="mt-4 px-4 py-2 bg-red-100 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors">
              Try Again
            </button>
          </div>
        )}

        {!loading && !error && hasSearched && results.length === 0 && (
          <div className="text-center py-20">
            {erFilteredAll ? (
              <>
                <p className="text-ink text-sm font-medium mb-2">No creators matched the Engagement Rate filter</p>
                <p className="text-ink-secondary text-sm max-w-md mx-auto">
                  Modash found creators but all were removed by the ER filter ({ER_OPTIONS[erMinIndex].label}).
                  Accounts with large followings typically have lower engagement rates. Try setting ER to &quot;Any&quot;.
                </p>
              </>
            ) : (
              <p className="text-ink-secondary text-sm">No creators found. Try adjusting your filters.</p>
            )}
          </div>
        )}

        {!loading && !error && results.length > 0 && (
          <>
            <p className="text-sm text-ink-secondary mb-4">
              Showing {results.length} of {formatNumber(total)} creators
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map((result) => {
                const rPlatform = getResultPlatform(result);
                return (
                  <CreatorCard
                    key={result.userId}
                    result={result}
                    platform={rPlatform}
                    showPlatformBadge={platformOption === "both"}
                    isAdded={addedUsernames.has(result.profile.username)}
                    onAdd={() => addToWatchlist(result, rPlatform)}
                    onSelect={() => setPanelCreator({ username: result.profile.username, platform: rPlatform, result })}
                  />
                );
              })}
            </div>
            {results.length < total && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => doSearch(mode === "ai", true)}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 border border-edge text-ink rounded-lg text-sm font-medium hover:bg-surface-secondary disabled:opacity-50 transition-colors"
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  {loadingMore ? "Loading..." : `Load More (${formatNumber(total - results.length)} remaining)`}
                </button>
              </div>
            )}
          </>
        )}

        {!hasSearched && !loading && (
          <div className="text-center py-20">
            <Search size={48} className="mx-auto text-ink-faint mb-4" />
            <p className="text-ink-secondary text-sm">Use the filters above and click Search to find creators</p>
          </div>
        )}
      </main>

      <SlidePanel isOpen={panelCreator !== null} onClose={() => setPanelCreator(null)}>
        {panelCreator && (
          <CreatorDetailContent
            key={panelCreator.username}
            username={panelCreator.username}
            platform={panelCreator.platform}
            variant="panel"
            onClose={() => setPanelCreator(null)}
            searchResult={panelCreator.result}
          />
        )}
      </SlidePanel>
    </div>
  );
}
