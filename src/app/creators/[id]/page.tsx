"use client";

import { useParams, useSearchParams } from "next/navigation";
import Nav from "@/components/Nav";
import CreatorDetailContent from "@/components/CreatorDetailContent";
import type { Platform } from "@/lib/types";

export default function CreatorDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const username = decodeURIComponent(params.id as string);
  const platform = (searchParams.get("platform") as Platform) || "instagram";

  return (
    <div className="min-h-screen bg-surface-secondary">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <CreatorDetailContent
          username={username}
          platform={platform}
          variant="page"
        />
      </main>
    </div>
  );
}
