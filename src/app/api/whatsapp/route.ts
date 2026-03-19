import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const twilioNumber = process.env.TWILIO_WHATSAPP_NUMBER!;

const MODASH_API_BASE = "https://api.modash.io/v1";
const MODASH_API_KEY = process.env.MODASH_API_KEY!;

const client = twilio(accountSid, authToken);

// In-memory session store: tracks last-looked-up creator per phone number
const sessions = new Map<
  string,
  {
    username: string;
    platform: "instagram" | "tiktok";
    followers: number;
    engagementRate: number;
    fullname: string;
    picture: string;
  }
>();

// ── Helpers ──────────────────────────────────────────────────────────

function fmt(n: number | undefined | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function pct(n: number | undefined | null): string {
  if (n == null) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function growthArrow(g: number | undefined | null): string {
  if (g == null) return "";
  const pctVal = (g * 100).toFixed(1);
  return g >= 0 ? `📈 +${pctVal}%` : `📉 ${pctVal}%`;
}

// ── Modash API calls (server-side, direct) ──────────────────────────

async function fetchReport(platform: string, username: string) {
  const url = `${MODASH_API_BASE}/${platform}/profile/${encodeURIComponent(username)}/report`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${MODASH_API_KEY}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data.error) return null;
  return data;
}

function countryFlag(code: string): string {
  try {
    return code
      .toUpperCase()
      .split("")
      .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
      .join("");
  } catch {
    return "";
  }
}

function normalizeReport(raw: Record<string, unknown>) {
  const p = raw.profile as Record<string, unknown> | undefined;
  if (!p) return null;
  const pp = (p.profile || {}) as Record<string, unknown>;
  const aud = (p.audience || {}) as Record<string, unknown>;
  const reelsRaw = (p.statsByContentType as Record<string, unknown>)?.reels as Record<string, unknown> | undefined;

  return {
    fullname: (pp.fullname as string) || "",
    username: (pp.username as string) || "",
    picture: (pp.picture as string) || "",
    followers: (pp.followers as number) || 0,
    engagementRate: (pp.engagementRate as number) || 0,
    engagements: (pp.engagements as number) || 0,
    followersGrowth: pp.followersGrowth as number | undefined,
    isVerified: (p.isVerified as boolean) || false,
    bio: p.bio as string | undefined,
    avgLikes: pp.avgLikes as number | undefined,
    avgComments: pp.avgComments as number | undefined,
    avgReelPlays: p.avgReelsPlays as number | undefined,
    audience: {
      credibility: aud.credibility as number | undefined,
      genders: aud.genders as { code: string; weight: number }[] | undefined,
      ages: aud.ages as { code: string; weight: number }[] | undefined,
      geoCountries: aud.geoCountries as { code: string; name: string; weight: number }[] | undefined,
      geoCities: aud.geoCities as { code: string; name: string; weight: number }[] | undefined,
      interests: aud.interests as { name: string; weight: number }[] | undefined,
      notableUsers: aud.notableUsers as { username: string; fullname?: string }[] | undefined,
    },
    audienceTypes: aud.audienceTypes as { code: string; weight: number }[] | undefined,
    reelsStats: reelsRaw ? {
      engagementRate: reelsRaw.engagementRate as number | undefined,
      avgLikes: reelsRaw.avgLikes as number | undefined,
      avgComments: reelsRaw.avgComments as number | undefined,
      avgShares: reelsRaw.avgShares as number | undefined,
      avgReelsPlays: reelsRaw.avgReelsPlays as number | undefined,
    } : undefined,
    sponsoredPosts: ((p.sponsoredPosts || []) as Array<Record<string, unknown>>),
    creatorBrandAffinity: ((pp.brandAffinity || []) as Array<{ name: string; weight: number }>),
    audienceBrandAffinity: ((aud.brandAffinity || []) as Array<{ name: string; weight: number }>),
    paidPostPerformance: p.paidPostPerformance as number | undefined,
  };
}

// ── Format report into WhatsApp message ─────────────────────────────

function buildCallouts(
  report: NonNullable<ReturnType<typeof normalizeReport>>,
): string[] {
  const callouts: string[] = [];

  // Growth callout
  if (report.followersGrowth != null) {
    const g = report.followersGrowth;
    const gPct = (g * 100).toFixed(1);
    if (g >= 0.05) callouts.push(`🚀 Rapid growth: +${gPct}% monthly`);
    else if (g >= 0.02) callouts.push(`📈 Strong growth: +${gPct}% monthly`);
    else if (g >= 0.005) callouts.push(`📈 Steady growth: +${gPct}% monthly`);
    else if (g >= 0) callouts.push(`➡️ Flat growth: +${gPct}% monthly`);
    else callouts.push(`📉 Declining: ${gPct}% monthly`);
  }

  // Credibility callout
  if (report.audience.credibility != null) {
    const c = report.audience.credibility;
    if (c >= 0.8) callouts.push(`🟢 Excellent audience credibility (${pct(c)})`);
    else if (c >= 0.6) callouts.push(`🟢 Good audience credibility (${pct(c)})`);
    else if (c >= 0.4) callouts.push(`🟡 Average audience credibility (${pct(c)})`);
    else callouts.push(`🔴 Low audience credibility (${pct(c)})`);
  }

  // Engagement callout
  const er = report.engagementRate;
  if (er >= 0.06) callouts.push(`🔥 Very high engagement (${pct(er)})`);
  else if (er >= 0.03) callouts.push(`💪 Above average engagement (${pct(er)})`);
  else if (er < 0.01 && er > 0) callouts.push(`⚠️ Low engagement (${pct(er)})`);

  // Top country callout
  if (report.audience.geoCountries?.length) {
    const top = report.audience.geoCountries[0];
    if (top.weight >= 0.4) {
      callouts.push(`${countryFlag(top.code)} Primarily ${top.name}-based audience (${pct(top.weight)})`);
    } else if (top.weight >= 0.2) {
      callouts.push(`🌍 Largest audience: ${top.name} (${pct(top.weight)})`);
    }
  }

  // Suspicious audience callout
  if (report.audienceTypes?.length) {
    const suspicious = report.audienceTypes.find((t) => t.code === "suspicious");
    if (suspicious && suspicious.weight >= 0.1) {
      callouts.push(`⚠️ ${pct(suspicious.weight)} suspicious followers detected`);
    }
  }

  // Brand deals callout
  if (report.sponsoredPosts.length > 0) {
    callouts.push(`🤝 ${report.sponsoredPosts.length} brand deals detected`);
  } else {
    callouts.push(`🟢 No brand deals detected — likely unsigned`);
  }

  // Notable followers callout
  if (report.audience.notableUsers?.length) {
    const top3 = report.audience.notableUsers.slice(0, 3).map((u) => `@${u.username}`).join(", ");
    callouts.push(`⭐ Notable followers: ${top3}`);
  }

  return callouts;
}

function formatReportMessage(
  report: NonNullable<ReturnType<typeof normalizeReport>>,
  platform: string
) {
  const platformEmoji = platform === "instagram" ? "📸" : "🎵";
  const platformName = platform === "instagram" ? "Instagram" : "TikTok";

  let msg = `${platformEmoji} *${report.fullname || report.username}* (@${report.username})\n`;
  msg += `${platformName} ${report.isVerified ? "✅ Verified" : ""}\n`;
  if (report.bio) {
    const shortBio = report.bio.length > 120 ? report.bio.slice(0, 120) + "..." : report.bio;
    msg += `_${shortBio}_\n`;
  }
  msg += `\n`;

  // ── Callouts (smart highlights at the top) ──
  const callouts = buildCallouts(report);
  if (callouts.length > 0) {
    msg += `💡 *Key Callouts*\n`;
    callouts.forEach((c) => {
      msg += `• ${c}\n`;
    });
    msg += `\n`;
  }

  // Core metrics
  msg += `📊 *Core Metrics*\n`;
  msg += `├ Followers: *${fmt(report.followers)}*\n`;
  msg += `├ Engagement Rate: *${pct(report.engagementRate)}*\n`;
  msg += `├ Avg Engagements: *${fmt(report.engagements)}*\n`;
  msg += `├ Avg Likes: *${fmt(report.avgLikes)}*\n`;
  msg += `├ Avg Comments: *${fmt(report.avgComments)}*\n`;
  if (report.avgReelPlays) msg += `├ Avg Reel Plays: *${fmt(report.avgReelPlays)}*\n`;
  if (report.followersGrowth != null) {
    msg += `└ Monthly Growth: ${growthArrow(report.followersGrowth)}\n`;
  }
  msg += `\n`;

  // Reels stats
  if (report.reelsStats) {
    const rs = report.reelsStats;
    msg += `🎬 *Reels Performance*\n`;
    if (rs.engagementRate) msg += `├ Reels ER: *${pct(rs.engagementRate)}*\n`;
    if (rs.avgReelsPlays) msg += `├ Avg Plays: *${fmt(rs.avgReelsPlays)}*\n`;
    if (rs.avgLikes) msg += `├ Avg Likes: *${fmt(rs.avgLikes)}*\n`;
    if (rs.avgShares) msg += `└ Avg Shares: *${fmt(rs.avgShares)}*\n`;
    msg += `\n`;
  }

  // Audience quality
  if (report.audience.credibility != null) {
    const cred = report.audience.credibility;
    const credEmoji = cred >= 0.7 ? "🟢" : cred >= 0.5 ? "🟡" : "🔴";
    msg += `🛡️ *Audience Quality*\n`;
    msg += `├ Credibility: ${credEmoji} *${pct(cred)}*\n`;
  }

  // Audience types (real vs suspicious)
  if (report.audienceTypes?.length) {
    const real = report.audienceTypes.find((t) => t.code === "real");
    const suspicious = report.audienceTypes.find((t) => t.code === "suspicious");
    const influencers = report.audienceTypes.find((t) => t.code === "influencers");
    if (real) msg += `├ Real People: *${pct(real.weight)}*\n`;
    if (influencers) msg += `├ Influencers: *${pct(influencers.weight)}*\n`;
    if (suspicious) msg += `└ Suspicious: *${pct(suspicious.weight)}*\n`;
  }
  msg += `\n`;

  // Demographics
  if (report.audience.genders?.length) {
    msg += `👥 *Demographics*\n`;
    const genderParts = report.audience.genders
      .sort((a, b) => b.weight - a.weight)
      .map((g) => {
        const label = g.code === "MALE" ? "♂ Male" : g.code === "FEMALE" ? "♀ Female" : g.code;
        return `${label} ${pct(g.weight)}`;
      });
    msg += `├ Gender: ${genderParts.join(" · ")}\n`;

    if (report.audience.ages?.length) {
      const topAges = report.audience.ages
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3)
        .map((a) => `${a.code}: ${pct(a.weight)}`);
      msg += `└ Top Ages: ${topAges.join(" · ")}\n`;
    }
    msg += `\n`;
  }

  // Top countries
  if (report.audience.geoCountries?.length) {
    msg += `🌍 *Top Countries*\n`;
    const countries = report.audience.geoCountries.slice(0, 5);
    countries.forEach((c, i) => {
      const prefix = i === countries.length - 1 ? "└" : "├";
      msg += `${prefix} ${countryFlag(c.code)} ${c.name}: *${pct(c.weight)}*\n`;
    });
    msg += `\n`;
  }

  // Top cities
  if (report.audience.geoCities?.length) {
    msg += `🏙️ *Top Cities*\n`;
    const cities = report.audience.geoCities.slice(0, 3);
    cities.forEach((c, i) => {
      const prefix = i === cities.length - 1 ? "└" : "├";
      msg += `${prefix} ${c.name}: *${pct(c.weight)}*\n`;
    });
    msg += `\n`;
  }

  // Top interests
  if (report.audience.interests?.length) {
    msg += `🎯 *Audience Interests*\n`;
    const interests = report.audience.interests.slice(0, 5);
    interests.forEach((int, i) => {
      const prefix = i === interests.length - 1 ? "└" : "├";
      msg += `${prefix} ${int.name}: *${pct(int.weight)}*\n`;
    });
    msg += `\n`;
  }

  // Brand deals
  if (report.sponsoredPosts.length > 0) {
    const brands = new Set<string>();
    report.sponsoredPosts.forEach((post) => {
      const sponsors = post.sponsors as Array<{ name: string }> | undefined;
      if (sponsors) sponsors.forEach((s) => brands.add(s.name));
    });
    msg += `🤝 *Brand Deals*: ${report.sponsoredPosts.length} sponsored posts\n`;
    if (brands.size > 0) {
      msg += `├ Brands: ${Array.from(brands).slice(0, 6).join(", ")}\n`;
    }
    if (report.paidPostPerformance != null) {
      const perf = report.paidPostPerformance;
      const perfLabel = perf >= 1
        ? `${((perf - 1) * 100).toFixed(0)}% above average`
        : `${((1 - perf) * 100).toFixed(0)}% below average`;
      msg += `└ Paid vs Organic: *${perfLabel}*\n`;
    }
    msg += `\n`;
  }

  // Creator brand affinity
  if (report.creatorBrandAffinity.length > 0) {
    const topBrands = report.creatorBrandAffinity.slice(0, 5).map((b) => b.name).join(", ");
    msg += `🏷️ *Creator Brand Affinity*: ${topBrands}\n`;
  }

  // Audience brand affinity
  if (report.audienceBrandAffinity.length > 0) {
    const topBrands = report.audienceBrandAffinity.slice(0, 5).map((b) => b.name).join(", ");
    msg += `🛒 *Audience Brand Affinity*: ${topBrands}\n`;
  }

  if (report.creatorBrandAffinity.length > 0 || report.audienceBrandAffinity.length > 0) {
    msg += `\n`;
  }

  // Notable followers
  if (report.audience.notableUsers?.length) {
    const names = report.audience.notableUsers.slice(0, 5).map((u) => `@${u.username}`).join(", ");
    msg += `⭐ *Notable Followers*: ${names}\n\n`;
  }

  msg += `─────────────────\n`;
  msg += `Reply *"add"* to add to your watchlist\n`;
  msg += `Reply *"tiktok @username"* or *"ig @username"* to look up another creator`;

  return msg;
}

// ── Parse incoming message ──────────────────────────────────────────

function parseMessage(body: string): {
  intent: "lookup" | "add" | "help" | "unknown";
  platform?: "instagram" | "tiktok";
  username?: string;
} {
  const text = body.trim().toLowerCase();

  // "add" or "add to watchlist"
  if (text === "add" || text.startsWith("add to") || text === "yes" || text === "save") {
    return { intent: "add" };
  }

  // Help
  if (text === "help" || text === "hi" || text === "hello" || text === "hey") {
    return { intent: "help" };
  }

  // Platform-specific lookup: "ig @username", "tiktok @username", "tt @username"
  const platformMatch = text.match(/^(ig|instagram|tiktok|tt)\s+@?(\S+)/i);
  if (platformMatch) {
    const p = platformMatch[1].toLowerCase();
    const platform = p === "ig" || p === "instagram" ? "instagram" : "tiktok";
    const username = platformMatch[2].replace(/^@/, "");
    return { intent: "lookup", platform, username };
  }

  // Just a username: "@username" or "username" (default to Instagram)
  const usernameMatch = text.match(/^@?([a-zA-Z0-9._]+)$/);
  if (usernameMatch) {
    return { intent: "lookup", platform: "instagram", username: usernameMatch[1] };
  }

  return { intent: "unknown" };
}

// ── Send WhatsApp message via Twilio ────────────────────────────────

async function sendWhatsApp(to: string, body: string) {
  // WhatsApp has a 1600 char limit per message — split if needed
  const MAX_LEN = 1550; // leave some headroom
  if (body.length <= MAX_LEN) {
    console.log(`[WhatsApp] Sending to ${to}: ${body.slice(0, 100)}...`);
    await client.messages.create({ from: twilioNumber, to, body });
    return;
  }

  // Split on double newlines (section breaks) to keep sections intact
  const sections = body.split("\n\n");
  const chunks: string[] = [];
  let current = "";

  for (const section of sections) {
    const candidate = current ? current + "\n\n" + section : section;
    if (candidate.length > MAX_LEN) {
      if (current) chunks.push(current);
      // If a single section is too long, just push it (will be truncated by Twilio)
      current = section;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  console.log(`[WhatsApp] Sending ${chunks.length} messages to ${to}`);
  for (const chunk of chunks) {
    console.log(`[WhatsApp] Chunk (${chunk.length} chars): ${chunk.slice(0, 80)}...`);
    await client.messages.create({ from: twilioNumber, to, body: chunk });
    // Small delay between messages to maintain order
    await new Promise((r) => setTimeout(r, 500));
  }
}

// ── Webhook handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // Twilio sends form-encoded data
    const formData = await req.formData();
    const from = formData.get("From") as string; // "whatsapp:+447..."
    const body = formData.get("Body") as string;

    console.log(`[WhatsApp] Received from ${from}: ${body}`);

    if (!from || !body) {
      return new NextResponse("OK", { status: 200 });
    }

    const parsed = parseMessage(body);

    switch (parsed.intent) {
      case "help": {
        await sendWhatsApp(
          from,
          `👋 *MVE Scout*\n\nI can pull audience reports for any creator.\n\n*Commands:*\n• Send *@username* — look up an Instagram creator\n• Send *ig @username* — look up on Instagram\n• Send *tiktok @username* — look up on TikTok\n• Send *add* — add the last creator to your watchlist\n\nTry it: send *@charlidamelio*`
        );
        break;
      }

      case "lookup": {
        const { platform, username } = parsed;
        if (!platform || !username) {
          await sendWhatsApp(from, `❌ Couldn't parse that. Try: *@username* or *ig @username*`);
          break;
        }

        await sendWhatsApp(from, `🔍 Looking up *@${username}* on ${platform === "instagram" ? "Instagram" : "TikTok"}...`);

        const raw = await fetchReport(platform, username);
        if (!raw) {
          // Try the other platform
          const otherPlatform = platform === "instagram" ? "tiktok" : "instagram";
          const rawAlt = await fetchReport(otherPlatform, username);
          if (rawAlt) {
            const report = normalizeReport(rawAlt);
            if (report) {
              sessions.set(from, {
                username,
                platform: otherPlatform,
                followers: report.followers,
                engagementRate: report.engagementRate,
                fullname: report.fullname,
                picture: report.picture,
              });
              await sendWhatsApp(
                from,
                `⚠️ Not found on ${platform === "instagram" ? "Instagram" : "TikTok"}, but found on ${otherPlatform === "instagram" ? "Instagram" : "TikTok"}:\n\n${formatReportMessage(report, otherPlatform)}`
              );
              break;
            }
          }
          await sendWhatsApp(
            from,
            `❌ Couldn't find *@${username}* on ${platform === "instagram" ? "Instagram" : "TikTok"}. Make sure the username is correct, or try specifying the platform: *tiktok @${username}*`
          );
          break;
        }

        const report = normalizeReport(raw);
        if (!report) {
          await sendWhatsApp(from, `❌ Got data for @${username} but couldn't parse the report. Try again later.`);
          break;
        }

        // Save to session for "add" command
        sessions.set(from, {
          username,
          platform,
          followers: report.followers,
          engagementRate: report.engagementRate,
          fullname: report.fullname,
          picture: report.picture,
        });

        await sendWhatsApp(from, formatReportMessage(report, platform));
        break;
      }

      case "add": {
        const session = sessions.get(from);
        if (!session) {
          await sendWhatsApp(
            from,
            `❌ No creator to add. Look up a creator first by sending *@username*`
          );
          break;
        }

        // Store the add request — the web app will pick this up
        // Since we're localStorage-based, we'll store pending adds server-side
        // and the web app polls or we provide an API
        const addData = {
          userId: session.username,
          username: session.username,
          display_name: session.fullname || session.username,
          platform: session.platform,
          followers: session.followers,
          engagement_rate: session.engagementRate * 100, // convert to percentage
          picture: session.picture,
          isVerified: false,
          location: "",
          gender: "",
          addedVia: "whatsapp",
          addedAt: new Date().toISOString(),
        };

        // Store in a simple in-memory queue (the web app can poll /api/whatsapp)
        pendingAdds.push({ data: addData, addedAt: Date.now() });

        await sendWhatsApp(
          from,
          `✅ *@${session.username}* has been added to your watchlist!\n\nOpen MVE Scout to see them in your watchlist.\n\nLook up another creator by sending *@username*`
        );

        // Clear session
        sessions.delete(from);
        break;
      }

      default: {
        await sendWhatsApp(
          from,
          `🤔 I didn't understand that.\n\nTry:\n• *@username* — look up a creator\n• *ig @username* or *tiktok @username*\n• *add* — add last looked-up creator to watchlist\n• *help* — see all commands`
        );
      }
    }

    // Return empty TwiML response (we're sending via the REST API instead)
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  } catch (error) {
    console.error("[WhatsApp] Error:", error);
    return new NextResponse(
      `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`,
      { status: 200, headers: { "Content-Type": "text/xml" } }
    );
  }
}

// ── Pending adds queue (polled by web app) ──────────────────────────

interface PendingAdd {
  userId: string;
  username: string;
  display_name: string;
  platform: "instagram" | "tiktok";
  followers: number;
  engagement_rate: number;
  picture: string;
  isVerified: boolean;
  location: string;
  gender: string;
  addedVia: string;
  addedAt: string;
}

const pendingAdds: { data: PendingAdd; addedAt: number }[] = [];

// GET endpoint for the web app to poll for new watchlist adds
// Items are kept for 5 minutes so multiple browser clients can pick them up
// (clients deduplicate via localStorage's "added" list)
export async function GET() {
  const now = Date.now();
  const KEEP_MS = 5 * 60 * 1000; // 5 minutes

  // Remove expired items
  while (pendingAdds.length > 0 && now - pendingAdds[0].addedAt > KEEP_MS) {
    pendingAdds.shift();
  }

  const items = pendingAdds.map((p) => p.data);
  return NextResponse.json({ items });
}
