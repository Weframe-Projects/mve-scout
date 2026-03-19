export function formatNumber(n: number | undefined | null): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString();
}

export function formatPercent(n: number | undefined | null): string {
  if (n == null) return "—";
  return n.toFixed(1) + "%";
}

export function timeAgo(dateString: string | number): string {
  const date = typeof dateString === "number" ? new Date(dateString * 1000) : new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function platformIcon(platform: "instagram" | "tiktok"): string {
  return platform === "instagram" ? "📷" : "🎵";
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    watching: "Watching",
    contacted: "Contacted",
    in_talks: "In Talks",
    signed: "Signed",
    passed: "Passed",
  };
  return map[status] || status;
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    watching: "bg-blue-50 text-blue-700",
    contacted: "bg-amber-50 text-amber-700",
    in_talks: "bg-purple-50 text-purple-700",
    signed: "bg-emerald-50 text-emerald-600",
    passed: "bg-gray-100 text-gray-500",
  };
  return map[status] || "bg-gray-100 text-gray-600";
}
