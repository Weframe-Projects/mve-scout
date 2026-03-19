import type { SearchResponse, SearchResult, ReportResponse } from "./types";

const BASE = "/api/modash";

export interface SearchFilters {
  platform: "instagram" | "tiktok";
  influencer?: Record<string, unknown>;
  sort?: { field: string; direction: string };
}

export async function searchCreators(
  filters: SearchFilters,
  page = 0
): Promise<SearchResponse> {
  const body: Record<string, unknown> = {
    filter: {
      influencer: filters.influencer || {},
    },
    page,
    sort: filters.sort || { field: "followers", direction: "desc" },
  };

  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "search",
      platform: filters.platform,
      body,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Search failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getReport(
  platform: "instagram" | "tiktok",
  username: string
): Promise<ReportResponse> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "report",
      platform,
      username,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Report failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getRawProfile(
  platform: "instagram" | "tiktok",
  username: string
): Promise<Record<string, unknown>> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "raw",
      type: "user-info",
      platform,
      username,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Raw profile failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function getRawFeed(
  platform: "instagram" | "tiktok",
  username: string
): Promise<Record<string, unknown>> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "raw",
      type: "user-feed",
      platform,
      username,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Raw feed failed: ${res.status} ${text}`);
  }

  return res.json();
}

export async function lookupLocations(
  query: string,
  platform: "instagram" | "tiktok" = "instagram"
): Promise<{ id: string; name: string; title: string }[]> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "locations",
      platform,
      query,
    }),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.locations || data || [];
}

export async function aiSearch(
  platform: "instagram" | "tiktok",
  query: string,
  aiFilters: {
    followersCount?: { min?: number; max?: number };
    gender?: string;
    engagementRate?: number;
  } = {},
  page = 0
): Promise<SearchResponse> {
  const body: Record<string, unknown> = { query, page };
  if (Object.keys(aiFilters).length > 0) body.filters = aiFilters;

  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "ai-search", platform, body }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI Search failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (data.error) return { error: true, total: 0, lookalikes: [] };

  // Note: AI Search response only returns userId, fullName, username, profilePicture,
  // followersCount, engagementRate, accountCategory, matchedPosts, recentPosts.
  // No location or gender data is available from this endpoint.
  const lookalikes: SearchResult[] = (data.profiles || []).map(
    (p: Record<string, unknown>) => ({
      userId: p.userId as string,
      profile: {
        username: p.username as string,
        fullname: (p.fullName as string) || (p.username as string),
        followers: p.followersCount as number,
        engagementRate: ((p.engagementRate as number) || 0) / 100,
        picture: (p.profilePicture as string) || "",
        isVerified: false,
      },
    })
  );

  return { error: false, total: data.total || lookalikes.length, lookalikes };
}

const interestIdCache = new Map<string, number | null>();

export async function lookupInterestId(
  query: string,
  platform: "instagram" | "tiktok" = "instagram"
): Promise<number | null> {
  const key = `${platform}:${query.toLowerCase()}`;
  if (interestIdCache.has(key)) return interestIdCache.get(key)!;

  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "interests", platform, query }),
  });
  if (!res.ok) { interestIdCache.set(key, null); return null; }
  const data = await res.json();
  const items = Array.isArray(data) ? data : (data.interests || data.items || []);
  const id = items[0]?.id;
  const result = typeof id === "number" ? id : null;
  interestIdCache.set(key, result);
  return result;
}

// Module-level cache so topic tags are only fetched once per session per niche+platform
const topicTagCache = new Map<string, string | null>();

export async function lookupTopicTag(
  query: string,
  platform: "instagram" | "tiktok" = "instagram"
): Promise<string | null> {
  const key = `${platform}:${query.toLowerCase()}`;
  if (topicTagCache.has(key)) return topicTagCache.get(key)!;

  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "topics", platform, query }),
  });
  if (!res.ok) { topicTagCache.set(key, null); return null; }
  const data = await res.json();
  // Modash topics endpoint returns: { error: false, tags: ["music", "musica", ...] }
  const tags: string[] = Array.isArray(data) ? data : (data.tags || data.topics || data.items || []);
  // Find the tag that most closely matches the query (prefer exact match)
  const queryLower = query.toLowerCase();
  const exactMatch = tags.find((t) => typeof t === "string" && t.toLowerCase() === queryLower);
  const result = exactMatch ?? (typeof tags[0] === "string" ? tags[0] : null);
  topicTagCache.set(key, result);
  return result;
}
