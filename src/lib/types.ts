export type Platform = "instagram" | "tiktok";

export type CreatorStatus =
  | "watching"
  | "contacted"
  | "in_talks"
  | "signed"
  | "passed";

export interface WatchlistCreator {
  userId: string;
  username: string;
  display_name: string;
  platform: Platform;
  followers: number;
  engagement_rate: number; // percentage e.g. 5.2 = 5.2%
  picture: string | null;
  isVerified: boolean;
  location: string;
  gender: string;
}

export interface Note {
  author: string;
  content: string;
  date: string; // ISO string
}

export interface SearchResult {
  userId: string;
  profile: {
    username: string;
    fullname: string;
    followers: number;
    engagementRate: number; // decimal e.g. 0.05 = 5%
    picture: string;
    isVerified: boolean;
  };
  match?: {
    influencer?: {
      geo?: {
        city?: { id: number; name: string };
        country?: { id: number; name: string; code?: string };
      };
      gender?: string;
    };
  };
  _platform?: Platform; // tagged at search time when searching "both"
}

export interface SearchResponse {
  error: boolean;
  total: number;
  lookalikes: SearchResult[];
}

export interface ReportProfile {
  followers: number;
  engagementRate: number;
  engagements: number;
  followersGrowth?: number; // month-over-month growth rate, e.g. 0.05 = +5%
  picture: string;
  fullname: string;
  username: string;
  isVerified: boolean;
  bio?: string;
}

export interface ReportAudience {
  genders?: { code: string; weight: number }[];
  ages?: { code: string; weight: number }[];
  geoCountries?: { code: string; name: string; weight: number }[];
  geoCities?: { code: string; name: string; weight: number }[];
  credibility?: number;
  notable?: { userId: string; username: string; fullname: string; picture: string }[];
  interests?: { name: string; weight: number }[];
}

export interface ReportStats {
  avgLikes?: number;
  avgComments?: number;
  avgReelPlays?: number;
  avgViews?: number;
}

export interface SponsoredPost {
  id: string;
  text?: string;
  url?: string;
  created?: string;
  type?: string;
  likes?: number;
  comments?: number;
  plays?: number;
  sponsors: { name: string; logo_url?: string; domain?: string }[];
}

export interface PopularPost {
  id: string;
  text?: string;
  url?: string;
  created?: string;
  type?: string;
  likes?: number;
  comments?: number;
  thumbnail?: string;
  plays?: number;
}

export interface ContentTypeStats {
  engagements?: number;
  engagementRate?: number;
  avgLikes?: number;
  avgComments?: number;
  avgShares?: number;
  avgReelsPlays?: number;
  statHistory?: StatHistoryEntry[];
}

export interface Lookalike {
  userId: string;
  username: string;
  picture?: string;
  fullname?: string;
  followers?: number;
  engagements?: number;
  isVerified?: boolean;
}

export interface AudienceType {
  code: string; // "real" | "suspicious" | "mass_followers" | "influencers"
  weight: number;
}

export interface BrandAffinity {
  id?: number;
  name: string;
  weight?: number;
}

export interface StatHistoryEntry {
  month: string; // "YYYY-MM"
  followers: number;
  avgLikes: number;
  following: number;
  avgComments: number;
  avgViews: number;
}

export interface ReportResponse {
  error: boolean;
  profile: ReportProfile;
  audience: ReportAudience;
  stats: ReportStats;
  statHistory?: StatHistoryEntry[];
  // New enriched data
  sponsoredPosts?: SponsoredPost[];
  popularPosts?: PopularPost[];
  reelsStats?: ContentTypeStats;
  lookalikes?: Lookalike[];
  audienceTypes?: AudienceType[];
  creatorBrandAffinity?: BrandAffinity[];
  audienceBrandAffinity?: BrandAffinity[];
  paidPostPerformance?: number;
}

export interface ContentItem {
  id: string;
  type: string;
  url?: string;
  thumbnail?: string;
  text?: string;
  created?: number;
  likes?: number;
  comments?: number;
  plays?: number;
  shares?: number;
  image_versions?: { items?: { url: string }[] };
  video_versions?: { url: string }[];
}
