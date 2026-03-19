# MVE Scout — Project Context for Claude Code

## Who is this for?

**Client**: Dean at **MVE Management** (talent management company).
**Builder**: Zachary Freud ("Levi") from Weframe (agency building this for Dean).
**CRITICAL**: The company is called "MVE" — NEVER write "MVP".

## What is this project?

A **talent scouting automation tool** for MVE Management. Dean scouts Instagram and TikTok creators to sign to his roster. This tool helps him:

1. **Search** for creators across IG and TikTok using Modash's API
2. **Add creators to a Watchlist** and track them through a pipeline (Watching → Contacted → In Talks → Signed → Passed)
3. **Pull audience reports** (demographics, credibility, top countries) for any creator — free via Modash
4. **Pull recent content** (posts, reels, plays, likes) via Modash Raw API (costs credits)
5. **Add notes** per creator

## Three deliverables

1. **Proposal document** (COMPLETED) — DOCX in `/proposal/` with credit math, $16K Modash cost, Slack integration plan
2. **PRD** (COMPLETED) — Developer handoff doc in `/prd/`
3. **The web tool** (IN PROGRESS) — This Next.js app. This is what you're working on.

---

## Tech Stack

- **Next.js 14** with App Router, TypeScript, Tailwind CSS
- **Modash API** (api.modash.io/v1) — Bearer token auth
- **No database** — all data stored in browser localStorage (intentional for demo/MVP)
- **No auth** — single-user tool for Dean
- **Light mode only** — clean, minimal design system

## Modash API Key

Stored in `.env.local`:
```
MODASH_API_KEY=skeT9zlUTuipoR34cxzWnzWFkCXPc7VP
```

## Modash API Endpoints Used

| Endpoint | Cost | Purpose |
|----------|------|---------|
| `POST /instagram/search` | FREE (0 credits) | Search for IG creators |
| `POST /tiktok/search` | FREE (0 credits) | Search for TT creators |
| `GET /instagram/locations?query=X` | FREE | Location ID lookup for filters |
| `GET /instagram/profile/{username}/report` | FREE | Full audience report (demographics, credibility, stats) |
| `GET /tiktok/profile/{username}/report` | FREE | Same for TikTok |
| `GET /raw/ig/user-info?url={username}` | 1 credit | Real-time IG profile data |
| `GET /raw/ig/user-feed?url={username}` | 1 credit | Real-time IG feed/posts |
| `GET /raw/tiktok/user-info?url={username}` | 1 credit | Real-time TT profile data |
| `GET /raw/tiktok/user-feed?url={username}` | 1 credit | Real-time TT feed/posts |

### Critical Modash API Gotchas

- Raw API param is `?url=username`, NOT `?username=username`
- TikTok search endpoint is `/tiktok/search`, NOT `/tiktok/search/influencers`
- TikTok raw endpoint is `/raw/tiktok/`, NOT `/raw/tt/`
- TikTok feed data is at `response.user_feed.items`, NOT `response.items`
- IG `like_count` can be `-1` when creator hides likes (play_count always available)
- Search response format: `{ error, total, lookalikes: [{ userId, profile: { username, fullname, followers, engagementRate (DECIMAL e.g. 0.05 = 5%), picture, isVerified }, match: { influencer: { geo: { city, country }, gender } } }] }`
- Report **raw** Modash shape: `{ error, profile: { userId, profile: { fullname, followers, engagementRate, engagements, avgLikes, avgComments }, isVerified, bio, avgReelsPlays, audience: { credibility, genders, ages, geoCountries, geoCities, interests, notableUsers } } }` — this is normalized in `route.ts` before returning
- Report **normalized** shape (what the app code sees): `{ error, profile: { fullname, username, picture, followers, engagementRate, engagements, isVerified, bio }, audience: { credibility, genders, ages, geoCountries, geoCities, interests, notable }, stats: { avgLikes, avgComments, avgReelPlays } }`
- `audience.notableUsers` in raw response is mapped to `audience.notable` in normalized response (`notable` in the raw response is a float score, not an array)
- Location filter requires numeric IDs from the locations lookup endpoint, NOT text strings
- ER in API responses is a decimal (0.05), UI displays as percentage (5%)

---

## Key Files

### API Layer
- **`src/lib/modash.ts`** — Modash API client. All fetch calls, SearchFilter type, extract metrics helpers.
- **`src/app/api/modash/route.ts`** — Next.js API proxy route. Actions: `lookup`, `search`, `report`, `raw`, `locations`.
- **`.env.local`** — Modash API key.

### Pages
- **`src/app/discover/page.tsx`** — Search page. Uses real Modash search API. Button-triggered search. Has AI search text input + dropdown filters. Saves added creators to localStorage.
- **`src/app/watchlist/page.tsx`** — Watchlist page. 100% localStorage-backed (no mock data). Shows creators added from Search or "Add by handle". Status dropdown per creator (Watching/Contacted/In Talks/Signed/Passed). Remove button on hover.
- **`src/app/creators/[id]/page.tsx`** — Creator detail page. URL param is the username. Loads from localStorage. Auto-fetches Modash report on load (free). Three tabs: Overview (audience report), Content (pull real posts via Raw API), Notes (localStorage).
- **`src/app/page.tsx`** — Redirects to `/discover`.
- **`src/app/pipeline/page.tsx`** — Old page, not actively used.

### Discover Components
- **`src/components/discover/FilterPanel.tsx`** — Filter dropdowns (platform, niche, gender, followers, ER) + TopicSearch + LocationSearch.
- **`src/components/discover/CreatorCard.tsx`** — Creator result card with add-to-watchlist button.
- **`src/components/discover/TopicSearch.tsx`** — Autocomplete for Modash topic tags. Debounced, queries `/api/modash` with `action: "topics"`.
- **`src/components/discover/LocationSearch.tsx`** — Autocomplete for Modash location IDs. Instagram only.

### Shared
- **`src/components/Nav.tsx`** — Top nav with "Search" and "Watchlist" tabs.
- **`src/lib/types.ts`** — TypeScript types (Creator, MetricSnapshot, ContentItem, Alert, etc.).
- **`src/lib/utils.ts`** — Formatting helpers (formatNumber, formatPercent, timeAgo, etc.).
- **`src/lib/mock-data.ts`** — Mock data (creators, snapshots, content, alerts, notes). **NOTE**: The watchlist and creator detail pages NO LONGER use mock data — they are 100% real Modash API + localStorage. The discover page still imports mockCreators only for the `alreadyWatching` check (this should also be removed and replaced with localStorage-only check).

### Design System
- **`src/app/globals.css`** — Tailwind config with custom color tokens.
- Light mode only. Color tokens: `surface`, `surface-secondary`, `surface-tertiary`, `ink`, `ink-secondary`, `ink-muted`, `edge`, `edge-strong`, `amber-*`, `emerald-*`.

---

## localStorage Schema

The tool stores all data in the browser's localStorage. Here are the keys:

| Key | Type | Purpose |
|-----|------|---------|
| `mve_watchlist_data` | `WatchlistCreator[]` | Array of creator objects added from Search or "Add by handle" |
| `mve_watchlist_added` | `string[]` | Array of usernames (for quick duplicate checks) |
| `mve_watchlist_status` | `Record<string, CreatorStatus>` | Username → pipeline status (watching, contacted, in_talks, signed, passed) |
| `mve_watchlist_dates` | `Record<string, string>` | Username → ISO date when added |
| `mve_notes_{username}` | `Array<{author, content, date}>` | Notes for a specific creator |

### WatchlistCreator shape (stored in `mve_watchlist_data`):
```typescript
{
  userId: string;
  username: string;
  display_name: string;
  platform: "instagram" | "tiktok";
  followers: number;
  engagement_rate: number;   // percentage (e.g. 5.2 = 5.2%)
  picture: string | null;    // Modash CDN URL
  isVerified: boolean;
  location: string;
  gender: string;
}
```

---

## Current State & Known Issues

### FIXED (recent)
- ~~Audience age filter 400 error~~ — removed audience filters from search (not needed for Dean's workflow)
- ~~Search UI not intuitive~~ — added AI Search / Filters toggle
- ~~ER filter doesn't work~~ — now sends `engagementRate` as plain decimal (e.g. `0.03`), which Modash accepts. Note: `{ min: 0.03 }` object format does NOT work — must be a plain number.
- ~~Discover page imports mockCreators~~ — removed, now uses localStorage only
- ~~[object Object] on creator cards~~ — fixed. `match.influencer.geo.city` and `.country` are objects `{id, name}`, not strings.

### Still TODO
- **Creator detail page lag**: Auto-fetches Modash report on load (takes seconds). Should show cached localStorage data instantly while report loads in background.
- **Creator detail page not pulling data**: May need `error: true` check on report response, fallback to other platform, better error display.

### Search Filter Architecture
- **Niche dropdown** (primary): Uses `influencer.relevance = ["#tag"]` — strict content-based filter. Pool sizes 6K-100K per niche. NICHES array has 22 options.
- **Topic autocomplete** (secondary, precise): Also uses `influencer.relevance`. Queries Modash `/topics` endpoint for suggestions. Takes precedence over niche when both set.
- **ER filter**: `influencer.engagementRate = 0.03` (plain decimal, NOT `{min: 0.03}`). Also applied client-side as fallback.
- **Location filter**: `influencer.location = [numericId]`. Instagram only. Uses Modash `/locations` endpoint for ID lookup.
- **Gender filter**: `influencer.gender = "MALE" | "FEMALE"`
- **Followers filter**: `influencer.followers = { min, max }`
- **Rejected approach**: `influencer.interests` (category IDs) was tested but too broad — only 27 categories, results often irrelevant.

---

## Demo Flow (how Dean will use this)

1. Open the app → lands on **Search** page
2. Either type an AI description ("fitness influencer in London") or use dropdown filters (platform, niche, gender, followers, ER)
3. Click **Search** → see real creators from Modash with photos, followers, ER, location
4. Click **Add to watchlist** on interesting creators
5. Go to **Watchlist** → see all added creators with real data
6. Change **status** (Watching → Contacted → In Talks → Signed)
7. Click into a creator → see real **audience report** (demographics, credibility, top countries, notable followers)
8. Pull **recent content** to see their latest posts and engagement
9. Add **notes** about the creator

---

## Design Principles

- **Light mode only** — clean, professional, minimal
- **Real data only** — everything uses the Modash API, no fake/mock data in the UI
- **Button-triggered search** — user selects filters then clicks Search (NOT auto-fire on every filter change)
- **Great UX** — loading states, error states with retry, empty states with CTAs
- **localStorage persistence** — all data survives page refresh, no backend needed for demo
- Currency: **$** for costs

---

## Build & Run

```bash
npm install
npm run dev        # starts on localhost:3000
npx next lint      # ESLint check
npx tsc --noEmit   # TypeScript check
npx next build     # production build
```

Make sure `.env.local` exists with the Modash API key before running.
