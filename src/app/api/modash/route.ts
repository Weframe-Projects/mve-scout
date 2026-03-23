import { NextRequest, NextResponse } from "next/server";
import { logSearch } from "@/lib/supabase";

const API_BASE = "https://api.modash.io/v1";
const API_KEY = process.env.MODASH_API_KEY!;

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { action, platform, username, body, type, query } = payload;

    console.log("[Modash] Incoming:", JSON.stringify(payload).slice(0, 500));
    console.log("[Modash] API_KEY:", API_KEY ? `${API_KEY.slice(0, 4)}...${API_KEY.slice(-4)} (${API_KEY.length})` : "MISSING");

    const headers: Record<string, string> = {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    };

    let url: string;
    let method = "GET";
    let fetchBody: string | undefined;

    switch (action) {
      case "search": {
        url = `${API_BASE}/${platform}/search`;
        method = "POST";
        fetchBody = JSON.stringify(body);
        break;
      }

      case "report": {
        url = `${API_BASE}/${platform}/profile/${encodeURIComponent(username)}/report`;
        break;
      }

      case "raw": {
        // Raw API: /raw/ig/ or /raw/tiktok/
        const rawPlatform = platform === "instagram" ? "ig" : "tiktok";
        url = `${API_BASE}/raw/${rawPlatform}/${type}?url=${encodeURIComponent(username)}`;
        break;
      }

      case "locations": {
        url = `${API_BASE}/${platform}/locations?query=${encodeURIComponent(query)}`;
        break;
      }

      case "lookup": {
        url = `${API_BASE}/${platform}/profile/${encodeURIComponent(username)}/report`;
        break;
      }

      case "ai-search": {
        url = `${API_BASE}/ai/${platform}/text-search`;
        method = "POST";
        fetchBody = JSON.stringify(body);
        break;
      }

      case "interests": {
        url = `${API_BASE}/${platform}/interests?query=${encodeURIComponent(query)}&limit=5`;
        break;
      }

      case "topics": {
        url = `${API_BASE}/${platform}/topics?query=${encodeURIComponent(query)}&limit=5`;
        break;
      }

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    console.log(`[Modash] ${method} ${url}`);
    if (fetchBody) console.log(`[Modash] Body:`, fetchBody);

    const res = await fetch(url, {
      method,
      headers,
      body: fetchBody,
      cache: "no-store",
    });

    const rawText = await res.text();
    console.log(`[Modash] Response ${res.status}:`, rawText.slice(0, 300));

    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: true, message: "Invalid JSON from Modash", raw: rawText.slice(0, 200) },
        { status: 502 }
      );
    }

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    // Log search and ai-search actions to Supabase
    if (action === "search" || action === "ai-search") {
      const resultCount = action === "search"
        ? data?.total ?? data?.lookalikes?.length ?? 0
        : data?.lookalikes?.length ?? 0;

      logSearch({
        action,
        platform,
        query: action === "ai-search" ? body?.query : undefined,
        filters: action === "search" ? body?.filter : body?.filters,
        resultCount,
        userAgent: req.headers.get("user-agent") || undefined,
      }).catch(() => {}); // fire-and-forget, don't block response
    }

    // Also log report lookups (when someone clicks into a creator)
    if (action === "report" || action === "lookup") {
      logSearch({
        action,
        platform,
        query: username,
        resultCount: data?.error ? 0 : 1,
        userAgent: req.headers.get("user-agent") || undefined,
      }).catch(() => {});
    }

    // Normalize Modash report response to match our TypeScript types
    // Actual Modash shape: { error, profile: { profile: {...}, audience: {...}, avgReelsPlays, bio, isVerified, ... } }
    // Expected shape:      { error, profile: {...}, audience: {...}, stats: {...}, + enriched data }
    if ((action === "report" || action === "lookup") && !data.error && data.profile) {
      const p = data.profile;
      const pp = p.profile || {};
      const aud = p.audience || {};
      const reelsStats = p.statsByContentType?.reels || undefined;
      data = {
        error: false,
        profile: {
          fullname: pp.fullname || "",
          username: pp.username || "",
          picture: pp.picture || "",
          followers: pp.followers || 0,
          engagementRate: pp.engagementRate || 0,
          engagements: pp.engagements || 0,
          followersGrowth: pp.followersGrowth ?? undefined,
          isVerified: p.isVerified || false,
          bio: p.bio,
        },
        audience: {
          credibility: aud.credibility,
          genders: aud.genders,
          ages: aud.ages,
          geoCountries: aud.geoCountries,
          geoCities: aud.geoCities,
          interests: aud.interests,
          notable: aud.notableUsers,
        },
        stats: {
          avgLikes: pp.avgLikes,
          avgComments: pp.avgComments,
          avgReelPlays: p.avgReelsPlays,
        },
        statHistory: p.statHistory || [],
        // Enriched data sections
        sponsoredPosts: p.sponsoredPosts || [],
        popularPosts: p.popularPosts || [],
        reelsStats: reelsStats ? {
          engagements: reelsStats.engagements,
          engagementRate: reelsStats.engagementRate,
          avgLikes: reelsStats.avgLikes,
          avgComments: reelsStats.avgComments,
          avgShares: reelsStats.avgShares,
          avgReelsPlays: reelsStats.avgReelsPlays,
        } : undefined,
        lookalikes: (p.lookalikes || []).map((l: Record<string, unknown>) => ({
          userId: l.userId,
          username: l.username,
          picture: l.picture,
          fullname: l.fullname,
          followers: l.followers,
          engagements: l.engagements,
          isVerified: l.isVerified,
        })),
        audienceTypes: aud.audienceTypes || [],
        creatorBrandAffinity: pp.brandAffinity || [],
        audienceBrandAffinity: aud.brandAffinity || [],
        paidPostPerformance: p.paidPostPerformance ?? pp.stats?.paidPostPerformance ?? undefined,
      };
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Modash API error:", error);
    return NextResponse.json(
      { error: true, message: String(error) },
      { status: 500 }
    );
  }
}
