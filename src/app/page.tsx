"use client";

import { useState } from "react";
import { CreativeCard } from "@/components/creative-card";
import { InputPanel } from "@/components/input-panel";
import type { CreativeUpgradeResult } from "@/types/creative";

interface ApiSuccess extends CreativeUpgradeResult {
  heroImage?: string | null;
  sourceUrl?: string;
  warnings?: string[];
}

interface ApiError {
  error: string;
  warnings?: string[];
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiSuccess | null>(null);

  async function handleSubmit(input: string) {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/creative-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const data = (await res.json()) as ApiSuccess | ApiError;
      if (!res.ok || "error" in data) {
        setError("error" in data ? data.error : "Request failed");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error — please retry");
    } finally {
      setLoading(false);
    }
  }

  function downloadBrief() {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `creative-brief-${result.asin}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-wider text-white/60">
          Amazon Creative Upgrade Engine
        </span>
        <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">
          The next hero image to ship for your listing.
        </h1>
        <p className="text-white/60">
          Paste an Amazon URL or ASIN. We read the listing, the reviews, and the
          competitors, then generate one upgraded hero image — with the slot,
          the on-image text, and why it wins.
        </p>
      </header>

      <InputPanel onSubmit={handleSubmit} loading={loading} />

      {error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-4">
          <div className="aspect-[1/1] w-full animate-pulse rounded-2xl border border-white/10 bg-white/5" />
        </div>
      ) : null}

      {result ? (
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm uppercase tracking-wider text-white/50">
                  Listing read
                </h2>
                <p className="mt-1 text-base text-white/90">
                  {result.listingSummary}
                </p>
                <p className="mt-2 text-xs text-white/40">
                  {result.asin} · {result.marketplace}
                  {result.sourceUrl ? (
                    <>
                      {" "}
                      ·{" "}
                      <a
                        href={result.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline hover:text-white/70"
                      >
                        view listing
                      </a>
                    </>
                  ) : null}
                </p>
              </div>
              <button
                type="button"
                onClick={downloadBrief}
                className="shrink-0 rounded-lg border border-white/15 bg-transparent px-3 py-2 text-xs text-white/80 transition hover:border-white/30"
              >
                Download brief
              </button>
            </div>
            {result.warnings && result.warnings.length > 0 ? (
              <ul className="list-disc pl-5 text-xs text-white/40">
                {result.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex flex-col gap-4">
            {result.creativeRecommendations.map((rec, i) => (
              <CreativeCard
                key={`${rec.slotNumber}-${i}`}
                recommendation={rec}
                rank={i + 1}
              />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
