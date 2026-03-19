"use client";

import { Search, Loader2, ChevronDown, X } from "lucide-react";
import LocationSearch, { type LocationValue } from "./LocationSearch";
import TopicSearch, { type TopicValue } from "./TopicSearch";

export type PlatformOption = "instagram" | "tiktok" | "both";

// Niche values are sent as influencer.relevance = ["#value"] in the search filter.
// Values must match Modash topic tags exactly (lowercase in the API call).
export const NICHES: { label: string; value: string }[] = [
  { label: "Beauty",      value: "beauty"      },
  { label: "Cars",        value: "cars"        },
  { label: "Comedy",      value: "comedy"      },
  { label: "Cooking",     value: "cooking"     },
  { label: "Dance",       value: "dance"       },
  { label: "Fashion",     value: "fashion"     },
  { label: "Fitness",     value: "fitness"     },
  { label: "Food",        value: "food"        },
  { label: "Gaming",      value: "gaming"      },
  { label: "Health",      value: "health"      },
  { label: "Lifestyle",   value: "lifestyle"   },
  { label: "Luxury",      value: "luxury"      },
  { label: "Makeup",      value: "makeup"      },
  { label: "Music",       value: "music"       },
  { label: "Pets",        value: "pets"        },
  { label: "Photography", value: "photographer" },
  { label: "Skincare",    value: "skincare"    },
  { label: "Sports",      value: "sports"      },
  { label: "Tech",        value: "tech"        },
  { label: "Travel",      value: "travel"      },
  { label: "Wellness",    value: "wellness"    },
  { label: "Yoga",        value: "yoga"        },
];

export type { TopicValue };

export const FOLLOWER_OPTIONS = [
  { label: "Any", value: 0 },
  { label: "1K", value: 1000 },
  { label: "5K", value: 5000 },
  { label: "10K", value: 10000 },
  { label: "25K", value: 25000 },
  { label: "50K", value: 50000 },
  { label: "100K", value: 100000 },
  { label: "250K", value: 250000 },
  { label: "500K", value: 500000 },
  { label: "1M", value: 1000000 },
  { label: "5M", value: 5000000 },
  { label: "10M+", value: 10000000 },
];

export const ER_OPTIONS = [
  { label: "Any", value: undefined as number | undefined },
  { label: "> 1%", value: 0.01 },
  { label: "> 2%", value: 0.02 },
  { label: "> 3%", value: 0.03 },
  { label: "> 5%", value: 0.05 },
  { label: "> 8%", value: 0.08 },
  { label: "> 10%", value: 0.1 },
];

export type { LocationValue };

export interface AudienceGeoValue {
  location: LocationValue;
  weight: number; // 0-1, e.g. 0.4 = 40%
}

export const AUDIENCE_WEIGHT_OPTIONS = [
  { label: "> 10%", value: 0.1 },
  { label: "> 20%", value: 0.2 },
  { label: "> 30%", value: 0.3 },
  { label: "> 40%", value: 0.4 },
  { label: "> 50%", value: 0.5 },
  { label: "> 60%", value: 0.6 },
  { label: "> 70%", value: 0.7 },
];

interface FilterPanelProps {
  platform: PlatformOption;
  setPlatform: (v: PlatformOption) => void;
  niche: string;
  setNiche: (v: string) => void;
  topic: TopicValue | null;
  setTopic: (v: TopicValue | null) => void;
  gender: string;
  setGender: (v: string) => void;
  followerMin: number;
  setFollowerMin: (v: number) => void;
  followerMax: number;
  setFollowerMax: (v: number) => void;
  erMinIndex: number;
  setErMinIndex: (v: number) => void;
  location: LocationValue | null;
  setLocation: (v: LocationValue | null) => void;
  audienceGeo: AudienceGeoValue | null;
  setAudienceGeo: (v: AudienceGeoValue | null) => void;
  loading: boolean;
  onSearch: () => void;
  onClear: () => void;
}

function Sel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-secondary mb-1.5">{label}</label>
      <div className="relative">
        {children}
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted pointer-events-none" />
      </div>
    </div>
  );
}

const selectCls = "w-full px-3 py-2.5 rounded-lg border border-edge bg-surface text-ink text-sm appearance-none focus:outline-none focus:border-ink-muted";

export default function FilterPanel({
  platform, setPlatform, niche, setNiche, topic, setTopic, gender, setGender,
  followerMin, setFollowerMin, followerMax, setFollowerMax,
  erMinIndex, setErMinIndex, location, setLocation,
  audienceGeo, setAudienceGeo,
  loading, onSearch, onClear,
}: FilterPanelProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Sel label="Platform">
          <select value={platform} onChange={(e) => setPlatform(e.target.value as PlatformOption)} className={selectCls}>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="both">Both</option>
          </select>
        </Sel>


        <Sel label="Niche">
          <select value={niche} onChange={(e) => setNiche(e.target.value)} className={selectCls}>
            <option value="">Any</option>
            {NICHES.map((n) => (
              <option key={n.value} value={n.value}>{n.label}</option>
            ))}
          </select>
        </Sel>

        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            Topic
            <span className="ml-1 text-ink-muted font-normal">(precise)</span>
          </label>
          <TopicSearch platform={platform} value={topic} onChange={setTopic} />
        </div>

        <div>
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            Creator Location
            <span className="ml-1 text-ink-muted font-normal">(Instagram only)</span>
          </label>
          <LocationSearch platform={platform} value={location} onChange={setLocation} />
        </div>

        <Sel label="Creator Gender">
          <select value={gender} onChange={(e) => setGender(e.target.value)} className={selectCls}>
            <option value="">Any</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
          </select>
        </Sel>

        <Sel label="Engagement Rate">
          <select value={erMinIndex} onChange={(e) => setErMinIndex(Number(e.target.value))} className={selectCls}>
            {ER_OPTIONS.map((opt, i) => <option key={i} value={i}>{opt.label}</option>)}
          </select>
        </Sel>

        <Sel label="Min Followers">
          <select
            value={followerMin}
            onChange={(e) => {
              const val = Number(e.target.value);
              setFollowerMin(val);
              if (followerMax > 0 && val > followerMax) setFollowerMax(val);
            }}
            className={selectCls}
          >
            {FOLLOWER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Sel>

        <Sel label="Max Followers">
          <select
            value={followerMax}
            onChange={(e) => {
              const val = Number(e.target.value);
              setFollowerMax(val);
              if (val > 0 && val < followerMin) setFollowerMin(val);
            }}
            className={selectCls}
          >
            <option value={0}>No max</option>
            {FOLLOWER_OPTIONS.filter((o) => o.value > 0).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Sel>

      </div>

      {/* Audience geo filter */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-ink-secondary mb-1.5">
            Audience Location
            <span className="ml-1 text-ink-muted font-normal">(country or city)</span>
          </label>
          <LocationSearch
            platform={platform}
            value={audienceGeo?.location ?? null}
            onChange={(loc) => {
              if (loc) {
                setAudienceGeo({ location: loc, weight: audienceGeo?.weight ?? 0.3 });
              } else {
                setAudienceGeo(null);
              }
            }}
          />
        </div>
        {audienceGeo && (
          <Sel label="Min Audience %">
            <select
              value={audienceGeo.weight}
              onChange={(e) => setAudienceGeo({ ...audienceGeo, weight: Number(e.target.value) })}
              className={selectCls}
            >
              {AUDIENCE_WEIGHT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </Sel>
        )}
      </div>

      {location && platform !== "instagram" && (
        <p className="text-xs text-amber-600">
          Location filtering is only available for Instagram. TikTok results will not be filtered by location.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onSearch}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-ink text-surface rounded-lg text-sm font-medium hover:bg-ink/90 disabled:opacity-50 transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Search
        </button>
        <button
          onClick={onClear}
          className="flex items-center gap-2 px-4 py-2.5 border border-edge rounded-lg text-sm text-ink-secondary hover:text-ink hover:border-edge-strong transition-colors"
        >
          <X size={14} />
          Clear
        </button>
      </div>
    </div>
  );
}
